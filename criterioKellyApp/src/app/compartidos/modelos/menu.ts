export interface Menu {
  icon: string;
  name: string;
  redirectTo: string;
  // Sin roles, la opción es para todos; con roles, solo para quien tenga alguno.
  roles?: number[];
}
