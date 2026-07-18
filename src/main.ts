import './style.css';
import { mountApp } from './ui/app';
import { installHostedTelemetry } from './core/telemetry';

installHostedTelemetry();
mountApp(document.querySelector<HTMLDivElement>('#app')!);
