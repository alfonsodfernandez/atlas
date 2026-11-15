# Datos publicables

Esta carpeta se copia al build público. **Nunca guardes aquí exportaciones de
Timeline ni configuración con coordenadas privadas.**

En la Fase 2 contendrá `atlas.json`, generado por el pipeline de agregación y
saneado, con esquema versionado y validación Zod. Por defecto, el dataset será
sintético y estará identificado como tal. La Fase 0 no genera ni carga ese JSON.

Revisa siempre el informe de privacidad antes de sustituir la muestra por datos
propios. Los originales pertenecen únicamente a `data/raw/` en tu ordenador y
la configuración privada a `atlas.config.json`; ambos están ignorados por Git.
