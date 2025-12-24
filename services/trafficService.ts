import { User } from '../types';

export interface TrafficEntry {
  id: string;
  timestamp: number;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'WS';
  endpoint: string;
  status: number;
  size: number; // bytes
  userAgent: string;
  ip: string;
  type: 'user' | 'bot' | 'suspicious' | 'system';
  severity: 'low' | 'medium' | 'high';
  payloadSummary?: string;
}

const TRAFFIC_LOG_KEY = 'weavenote_traffic_logs';
const MAX_LOGS = 200;

const BOT_KEYWORDS = ['bot', 'crawler', 'spider', 'headless', 'lighthouse', 'inspect', 'curl', 'wget'];

export const logTraffic = async (
  method: TrafficEntry['method'],
  endpoint: string,
  status: number,
  size: number,
  payload?: any
) => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isBot = BOT_KEYWORDS.some(k => userAgent.includes(k));
  
  let type: TrafficEntry['type'] = isBot ? 'bot' : 'user';
  let severity: TrafficEntry['severity'] = 'low';

  // Real detection: Suspicious Status
  if (status >= 400 && !isBot) {
    type = 'suspicious';
    severity = 'medium';
  }

  // Real detection: Injection Patterns in Payload
  const payloadStr = JSON.stringify(payload || {}).toLowerCase();
  if (payloadStr.includes('<script') || payloadStr.includes('select * from') || payloadStr.includes('drop table') || payloadStr.includes(' union ')) {
    type = 'suspicious';
    severity = 'high';
  }

  const entry: TrafficEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    method,
    endpoint,
    status,
    size,
    userAgent: navigator.userAgent,
    ip: localStorage.getItem('weavenote_last_ip') || 'Local/Client',
    type,
    severity,
    payloadSummary: payloadStr.substring(0, 150)
  };

  const logs = getTrafficLogs();
  logs.unshift(entry);
  localStorage.setItem(TRAFFIC_LOG_KEY, JSON.stringify(logs.slice(0, MAX_LOGS)));
  
  // Dispatch event for real-time UI updates
  window.dispatchEvent(new CustomEvent('weavenote_traffic_update', { detail: entry }));
};

export const getTrafficLogs = (): TrafficEntry[] => {
  try {
    return JSON.parse(localStorage.getItem(TRAFFIC_LOG_KEY) || '[]');
  } catch {
    return [];
  }
};

export const clearTrafficLogs = () => {
  localStorage.removeItem(TRAFFIC_LOG_KEY);
};