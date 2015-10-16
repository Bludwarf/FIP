# FIP
Pour voir les archives antennes de la radio FIP de manière plus sympathique.

Exemple de rendu une fois le userscript chargé avec TamperMonkey et le CSS avec l'inspector-stylesheet de Chrome.

![capture](doc/exemple-20150904.png)

# Installation
Installer l'extension Chrome "TamperMonkey".

Cliquer sur l'URL suivante : https://github.com/Bludwarf/FIP/raw/master/fip-grid.user.js.

TamperMonkey se charge automatiquement. Cliquer alors sur le bouton "Installer".

![capture](doc/TamperMonkey-install.png)

Le script sera ensuite chargé à chaque fois que vous retournez sur cette page de FIP. TamperMonkey vous le confirme en ajoutant un petit point rouge sur son icone en haut à droite.

![capture](doc/TamperMonkey-2015-09-04.png)

# Ajout du CSS

Une fois le script chargé avec TamperMonkey ouvrez les outils Web de Chrome avec `F12`.
Sur n'importe quel élément ajouter un style personnalisé en cliquant sur le petit plus tout en haut à droite.

![inspector](doc/inspector-2015-09-04_111024.png)

Cliquer ensuite sur le lien `inspector-stylesheet` pour ouvrir la feuille de style courant de Chrome.

![inspector](doc/inspector-2015-09-04_111637.png)

Remplacer tout le contenu par le CSS du fichier [styles.css](styles.css).
