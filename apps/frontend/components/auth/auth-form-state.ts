export type AuthActionState = {
  error?: string;
  fields?: Record<string, string>;
};

export const initialAuthActionState: AuthActionState = {
  fields: {},
};
