export type BiologicalSex = 'male' | 'female' | 'other';
export type UnitSystem = 'metric' | 'imperial';
export type FitnessLevel = 'sedentary' | 'beginner' | 'intermediate' | 'advanced';

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  weight: number;
  height: number;
  birthDate: string;
  biologicalSex: BiologicalSex;
  unitSystem?: UnitSystem;
  fitnessLevel?: FitnessLevel;
  primaryGoal?: string;
}