export interface Task {
  id: string;
  jiraKey: string;
  summary: string;
  type: string;
  priority: string;
  status: string;
  assignee: string;
  sprint: string;
  developer: string;
  effortDays: number;
  devEta: string;
  effortL0Num: number | null;
  effortL0Txt: string;
  effortL1Num: number | null;
  effortL1Txt: string;
  notes: string;
  lastSynced: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface Sprint {
  id: string;
  name: string;
  start: string;
  end: string;
  status: string;
}

export interface Developer {
  id: number;
  name: string;
  jiraAccountId: string | null;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
}

export interface Config {
  jiraConnected: boolean;
  fieldMap: Record<string, string>;
  jiraBaseUrl: string;
}
