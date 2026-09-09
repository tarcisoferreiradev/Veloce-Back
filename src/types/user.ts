export type BiologicalSex = 'male' | 'female' | 'other';
export type UnitSystem = 'metric' | 'imperial';
export type FitnessLevel = 'sedentary' | 'beginner' | 'intermediate' | 'advanced';

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  weight: number; // Fornecido na unidade informada pelo cliente
  height: number; // cm ou inches
  birthDate: string; // ISO 8601 YYYY-MM-DD
  biologicalSex: BiologicalSex;
  unitSystem?: UnitSystem;
  fitnessLevel?: FitnessLevel;
  primaryGoal?: string;
}