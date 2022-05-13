## Présentation
- Celui-ci est un serveur nestjs tournant sur l'ordinateur ayant les équipements médicaux
   - Il envoie les donnés du moniteur de signe vitaux
   - De la carte vitale
   - Lis les fichiers générés par le logiciel Cardiolane

### build

``nest build``

``nexe dist/main.js --build``

## Installation

1. Il faut tout d'abord installer nodejs ainsi que npm 
lien : https://nodejs.org/dist/v14.17.3/node-v14.17.3-x64.msi

2. Il faut ensuite installer pm2 qui se charge de relancer le serveur au cas où celui ci crasherait ou au rédemarrage de l'ordinateur : 

    `npm install pm2 -g`

3. Copier le dossier /connector (le mettre dans une clé usb par ex) dans l'ordinateur cible, lancer

    `npm install` 

    puis

    `npm run build`

4. Lancez PM2 

    Il faut installer un package spécifique pour que pm2 se lance au chargement de windows

   `npm install pm2-windows-startup -g`

   `pm2-startup install`


   `pm2 start dist/main.js`

   `pm2 save`

    Vous pouvez vous assurer du bon fonctionnement à l'aide de la commande 

   `pm2 monit`
