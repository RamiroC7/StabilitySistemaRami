// Corre antes de cada archivo de test (ver vite.config.ts -> test.setupFiles).
//
// Fija la zona horaria del proceso a Argentina — la app y sus alumnos viven
// ahi, y varios de los tests (corte de lunes, entrenamiento a las 22:26 que
// cruza medianoche en UTC) dependen de esa zona especifica. Sin esto, los
// mismos tests podrian pasar en una compu configurada en -03:00 y fallar en
// un servidor de CI corriendo en UTC, solo por la diferencia de reloj — no
// porque el codigo este mal.
process.env.TZ = "America/Argentina/Buenos_Aires";
