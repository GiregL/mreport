# Cr�ation d'un fichier demo.sql contenant la structure de la base de donn�es plus les donn�es associ�es aux rapports s�lectionn�s.

Le script est � ex�cuter depuis la machine contenant la base de donn�es MREPORT. Il requiert la pr�sence du fichier export.sql.

## Usage

Des variables sont �ventuellement � modifier dans le fichier export.sh

``
PORT=5432
SCHEMA=data
DBSOURCE=dataviz
DBTEMP=dataviz_demo
WKS=/tmp
USER=dataviz_user
``

`su postgres`
`./export.sh rapport1 rapport2 rapportn`

Le script produit un fichier demo.sql en sortie avec 2 variables (:schema & :user)



