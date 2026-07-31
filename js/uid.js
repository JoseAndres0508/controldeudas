/* Generador de ids cortos, sin dependencias. */
export const uid = () => Math.random().toString(36).slice(2, 9);
