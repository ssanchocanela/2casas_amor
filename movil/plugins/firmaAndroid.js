/**
 * Firma el APK de release con la clave propia de la familia, no con la de
 * depuración que trae la plantilla de Expo (que es pública).
 *
 * La clave y sus contraseñas NO están en el repositorio: se leen de las
 * propiedades de Gradle del usuario, en ~/.gradle/gradle.properties:
 *
 *   DOSCASAS_KEYSTORE=/home/…/.doscasas/doscasas-release.keystore
 *   DOSCASAS_KEYSTORE_PASSWORD=…
 *   DOSCASAS_KEY_ALIAS=doscasas
 *   DOSCASAS_KEY_PASSWORD=…
 *
 * Sin esas propiedades, el release se firma con la clave de depuración: sirve
 * para probar, no para instalar en los móviles.
 *
 * Esa clave no se puede perder. Android solo instala una versión nueva encima
 * de la anterior si va firmada con la misma clave; con otra, habría que
 * desinstalar la app y se perdería lo que no hubiera subido.
 */

const { withAppBuildGradle } = require('expo/config-plugins');

const MARCA = '// doscasas: firma de release';

module.exports = function firmaAndroid(config) {
  return withAppBuildGradle(config, (c) => {
    let gradle = c.modResults.contents;
    if (gradle.includes(MARCA)) return c;

    gradle = gradle.replace(/signingConfigs \{\n/, `signingConfigs {
        ${MARCA}
        release {
            if (project.hasProperty('DOSCASAS_KEYSTORE')) {
                storeFile file(DOSCASAS_KEYSTORE)
                storePassword DOSCASAS_KEYSTORE_PASSWORD
                keyAlias DOSCASAS_KEY_ALIAS
                keyPassword DOSCASAS_KEY_PASSWORD
            }
        }
`);
    // El primer signingConfig que aparece dentro de 'release' en buildTypes.
    gradle = gradle.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig project.hasProperty('DOSCASAS_KEYSTORE') ? signingConfigs.release : signingConfigs.debug",
    );

    if (!gradle.includes(MARCA) || !gradle.includes('signingConfigs.release')) {
      throw new Error('firmaAndroid: build.gradle no tiene la forma esperada; revisa el plugin.');
    }
    c.modResults.contents = gradle;
    return c;
  });
};
