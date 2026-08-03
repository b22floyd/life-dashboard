export const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

export type Quarter = (typeof QUARTERS)[number];

export const MAX_ANNUAL_GOALS = 5;

export type GoalCheckpoint = {
  id: string;
  quarter: Quarter;
  targetDescription: string;
  completed: boolean;
  completedAt: string | null;
};

export type GoalCheckinNote = {
  id: string;
  note: string;
  createdAt: string;
};

export type AnnualGoal = {
  id: string;
  title: string;
  description: string;
  position: number;
  createdAt: string;
  checkpoints: GoalCheckpoint[]; // always exactly 4, ordered Q1..Q4
  notes: GoalCheckinNote[]; // newest first
};

export function computeGoalProgress(goal: AnnualGoal): { completed: number; total: number } {
  return {
    completed: goal.checkpoints.filter((checkpoint) => checkpoint.completed).length,
    total: goal.checkpoints.length,
  };
}
