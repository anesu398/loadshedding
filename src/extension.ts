import * as vscode from 'vscode';
import axios from 'axios';

let statusBarItem: vscode.StatusBarItem;

function logMessage(message: string) {
    const outputChannel = vscode.window.createOutputChannel('Load-shedding Notifier');
    outputChannel.appendLine(message);
    outputChannel.show();
}

async function fetchLoadsheddingData(apiEndpoint: string): Promise<any> {
    try {
        logMessage(`Fetching data from ${apiEndpoint}`);
        const response = await axios.get(apiEndpoint);
        logMessage('Data fetched successfully');
        return response.data;
    } catch (error) {
        vscode.window.showErrorMessage('Error fetching load-shedding data');
        logMessage(`Error: ${error}`);
        return null;
    }
}

function checkLoadsheddingSchedule(schedule: any, notificationThreshold: number, context: vscode.ExtensionContext) {
    const now = new Date();
    let upcomingEvent: Date | null = null;
    const lastEvent = context.globalState.get<string>('lastEvent');
    let newEvent = '';

    for (const event of schedule.events) {
        const start = new Date(event.startTime);
        const end = new Date(event.endTime);

        if (now >= start && now <= end) {
            newEvent = `Load-shedding until ${end.toLocaleTimeString()}`;
            if (lastEvent !== newEvent) {
                vscode.window.showWarningMessage(newEvent);
                context.globalState.update('lastEvent', newEvent);
                logMessage(newEvent);
            }
            statusBarItem.text = `$(alert) ${newEvent}`;
            return;
        } else if (now < start && (start.getTime() - now.getTime()) <= notificationThreshold * 60 * 1000) {
            upcomingEvent = start;
        }
    }

    if (upcomingEvent) {
        newEvent = `Load-shedding at ${upcomingEvent.toLocaleTimeString()}`;
        if (lastEvent !== newEvent) {
            vscode.window.showWarningMessage(newEvent);
            context.globalState.update('lastEvent', newEvent);
            logMessage(newEvent);
        }
        statusBarItem.text = `$(clock) ${newEvent}`;
    } else {
        newEvent = 'No load-shedding';
        if (lastEvent !== newEvent) {
            statusBarItem.text = `$(check) ${newEvent}`;
            context.globalState.update('lastEvent', newEvent);
            logMessage(newEvent);
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = '$(sync~spin) Checking load-shedding...';
    statusBarItem.show();

    const config = vscode.workspace.getConfiguration('loadsheddingNotifier');
    const apiEndpoint = config.get<string>('apiEndpoint') || 'https://api.example.com/loadshedding';
    const checkInterval = (config.get<number>('checkInterval') || 15) * 60 * 1000;
    const notificationThreshold = config.get<number>('notificationThreshold') || 30;

    let disposable = vscode.commands.registerCommand('extension.checkLoadshedding', async () => {
        const schedule = await fetchLoadsheddingData(apiEndpoint);
        if (schedule) {
            checkLoadsheddingSchedule(schedule, notificationThreshold, context);
        }
    });

    context.subscriptions.push(disposable);

    const interval = setInterval(async () => {
        const schedule = await fetchLoadsheddingData(apiEndpoint);
        if (schedule) {
            checkLoadsheddingSchedule(schedule, notificationThreshold, context);
        }
    }, checkInterval);

    context.subscriptions.push({ dispose: () => clearInterval(interval) });
}

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
