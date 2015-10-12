// ==UserScript==
// @name         Archives FIP
// @namespace    http://bludwarf.fr/fip
// @version      0.1
// @downloadURL  https://raw.githubusercontent.com/Bludwarf/FIP/master/fip-grid.user.js
// @description  Récup facile des archives FIP en une seule page
// @author       bludwarf@gmail.com
// @match        http://www.fipradio.fr/archives-antenne*
// @grant        none
// ==/UserScript==

function importJS(src) {
	src = src || "https://ajax.googleapis.com/ajax/libs/jquery/1/jquery.min.js";

	var jq = document.createElement('script');
	jq.src = src;
	document.getElementsByTagName('head')[0].appendChild(jq);
	
	// ... give time for script to load, then type.
	alert('give time for script to load, then press OK');
	jQuery.noConflict();
}

/**
 * Importe une feuille de style CSS dans le document.
 * Attention : pour les fichiers RAW de Github utiliser les URL en rawgit. Cf : https://rawgit.com/ (remplacement automatisé dans cette fonction)
 * @param href lien vers la feuille de style
 * @author http://www.abeautifulsite.net/manipulating-stylesheets-with-greasemonkey/
 */
function importCSS(href) {
	// URL en RAW github
	var rawGitRx = /\/\/raw\.githubusercontent\.com\//;
	if (href.match(rawGitRx)) {
		href = href.replace(rawGitRx, "//cdn.rawgit.com/");  // on utilise rawgit pour avoir le bon Content-Type
		console.log('On passe par Raw Git pour charger la feuille de style => %s', href);
	}

	var link = window.document.createElement('link');
	link.rel = 'stylesheet';
	link.type = 'text/css';
	link.href = href;
	document.getElementsByTagName("HEAD")[0].appendChild(link);
}



// 
var fip = {};

// Le jQuery utilisé par FIP
fip.$ = window.jQuery;

/**
 * @param {string} jour (optionnel : défaut : date du jour)
 * @param {number} heure (optionnel : défaut : heure actuelle)
 */
fip.date = function(jour, heure) {
	if (typeof jour === 'number') {
		heure = jour;
		jour = null;
	}
	jour = jour || this.jour();
	if (typeof heure === 'undefined') {
		heure = new Date().getHours();
	}
	if (heure < 10) heure = '0' + heure;
	return new Date(jour + 'T' + heure + ':00+0200'); // FIXME : et en hiver ?
}

/**
 * Le jour courant (ou la date passée en paramètre) au format "2015-06-22"
 */
fip.jour = function(date) {
	var date = date || new Date();
	var m = date.getMonth() + 1;
	if (m < 10) m = '0' + m;
	var d = date.getDate();
	if (d < 10) d = '0' + d;
	return (date.getYear() + 1900) + '-' + m + '-' + d;
}

/**
 * Pour l'affichage des détails d'un son
 */
fip.details = function() {

	var detailsDiv = this.detailsDiv || fip.$('#details-son');
	
	if (!detailsDiv || detailsDiv.size() != 1) {
		// Ajout des détails pour le son sélectionné
		detailsDiv = fip.$('<div id="details-son" class="block block-rf-social"></div>').prependTo(fip.$('#sidebar'));
		this.detailsDiv = detailsDiv;
	}

	return detailsDiv;
}



/**
 * @param jour '2015-06-22'
 * @param heure 13
 * @param callback function(fip.Son)
 * cache : this.sons[jour][heure] = sons (fip.Son)
 *
 * Exemple pour charger tous les sons du 22 juin 2015 de 13h :

		var sons = [];
		fip.eachSon('2015-06-22', 13, function(son) {
			sons.push(son);
		});

 */
fip.eachSon = function(jour, heure, callback) {

	console.time('Récup des sons du FIP : '+jour+' '+heure+'h');

	// Date réelle
	var date = fip.date(jour, heure);
	var diff = (new Date() - date) / 3600000; // heure écoulée depuis (diff < 1 <=> créneau courant)
	
	// Cache
	if (!this.sons) this.sons = {};
	if (!this.sons[jour]) this.sons[jour] = {};
	if (this.sons[jour][heure]) {
		if (!this.sons[jour][heure].incomplete) {
			var sons = this.sons[jour][heure];
			console.log('use cache : '+diff+'h'); // TODO : ne pas utiliser le cache pour le creneau actuel
			Array.prototype.forEach.call(sons, function(son) {
				callback(son);
			});
			return;
		}
		else {
			console.log('On utilise pas le cache car ce créneau est incomplet');
		}
	}
	else {
		this.sons[jour][heure] = [];
		
		// On note que le créneau est incomplet si c'est le créneau actuel
		this.sons[jour][heure].incomplete = true;
	}

	// Requête Ajax
	var zis = this;
	fip.ajax(jour, heure, function(data) {
		var $sons = fip.$('div.list-song div.son', data); // avant sept 2015 : '#block-system-main div.list-song div.son'
		if ($sons.size() === 0) {
			throw new Error('Aucun son trouvé dans le HTML chargé : ' + jour + ' à ' + heure + 'h');
		}
		$sons.each(function(i, e) {
			var son = new fip.Son(e, jour);
			zis.sons[jour][heure].push(son);
			callback(son);
		});

		// Si le créneau est passé on le marque comme complet
		if (diff >= 1) delete zis.sons[jour][heure].incomplete;

		console.timeEnd('Récup des sons de FIP : '+jour+' '+heure+'h');
	});

};

/**
 *
 * @param jour
 * @param heure
 * @param cb fn(data) avec data le contenu HTML comme avant septembre 2015
 */
fip.ajax_2015 = function(jour, heure, callback) {
	// GET Ajax
	var url = '/archives-antenne?start_date='+jour+'&start_hour='+heure;
	var zis = this;
	fip.$.get(url, function(data, textStatus, jqXHR) {
		callback(data);
	});

	// TODO URL ? : http://www.fipradio.fr/sites/default/files/import_si/si_titre_antenne/FIP_player_current.json?_=1435133287777
	// _ : new Date().getTime()
};

/**
 * Converti un jour au format aaaa-mm-jj en Date (ne surtout pas faire new Date('aaaa-mm-jj') car cela concerne uniquement le GMT:0)
 * @param jour format 'aaaa-mm-jj'
 */
fip.date = function(jour) {
	var amj = jour.split('-');
	return new Date(amj[0], amj[1] - 1, amj[2]);
};

/**
 *
 * @param jour
 * @param heure
 * @param cb fn(data) avec data le contenu HTML comme avant septembre 2015
 */
fip.ajax_2015_09 = function(jour, heure, cb) {
	var url = 'http://www.fipradio.fr/system/ajax';
	var date = fip.date(jour);
	var form_build_id = document.forms['fip-titres-diffuses-form-search-date'].form_build_id.value;
	var form_id = document.forms['fip-titres-diffuses-form-search-date'].form_id.value;
	fip.$.post(url, {
		select_jour: date.getTime() / 1000,
		select_heure: heure,
		form_build_id: form_build_id,
		form_id: form_id,
		_triggering_element_name: 'op',
		_triggering_element_value: 'OK'
	}, function(response, textStatus, jqXHR) {

		if (!response) throw new Error('Pas de réponse Ajax');
		if (!response instanceof Array) throw new Error('La réponse Ajax doit être un tableau');

		// On cherche la réponse qui a pour propriété command 'insert' et une propriété data
		var data = null;
		response.forEach(function(res) {
			if (res.data && res.command === 'insert') {
				data = res.data;
			}
		});

		if (!data) throw new Error('Aucune réponse Ajax contenant data');

		if (!cb) throw new Error('Callback après Ajax manquant');

		cb(data);

	});
};

/**
 * Ajax actuel
 */
fip.ajax = fip.ajax_2015_09;

/*fip.isComplete = function(jour, heure) {
	return this.sons[jour] && this.sons[jour][heure] && !this.sons[jour][heure].incomplete;
}*/

fip.Son = function(div, jour) {
	var $div = fip.$(div);
	this.$div = $div;
	this.jour = jour;
	
	this.image = new fip.Son.Image(fip.$('img', $div).get(0));
}

/*fip.Son.getFromDiv = function(div) {
	if (!this.sonsFromDiv) this.sonsFromDiv = {};
	if (this.sonsFromDiv[div]) return this.sonsFromDiv[div]; // [div] sera toujours égal à [Object object]
	
	var son = new fip.Son(div);
	console.log('nouveau son from DIV : ');
	tree(son);
	this.sonsFromDiv[div] = son;
	return son;
}*/

/**
 * 13h56
 */
fip.Son.prototype.heure = function() {
	return fip.$('.titre_date > span', this.$div).html().trim();
}

/**
 *
 */
// TODO : accents ?
fip.Son.prototype.artiste = function() {
	return fip.$('.titre_artiste', this.$div).html().trim();
}

fip.Son.prototype.title = function() {
	return fip.$('.titre_title', this.$div).html().trim();
}
fip.Son.prototype.titre = fip.Son.prototype.title;

/**
 * Toujours en majuscule et sans l'année.
 * 
 * Format #1 : SOYO (2015)
 * Format #2 : SOYO
 */
fip.Son.prototype.album = function() {
	var album = fip.$('.titre_album', this.$div).html().trim();
	
	if (!album.startsWith('Album&nbsp;: ')) throw new Error('On arrive pas à devenir le nom de l\'album dans la chaine : ' + album);
	album = album.substr('Album&nbsp;: '.length);
	
	// Avec Date ? format : " (2014)" par exemple
	var result = /^(.+) +\(\d{4}\)$/ig.exec(album);
	if (result) return result[1];
	
	return album;
}

/**
 * @param date : par défaut this.date() (ex : "14h56")
 */
fip.Son.prototype.date = function() {
	var h = this.heure().replace('h', ':');
	return new Date(this.jour+'T'+h+'+0200');
}

/**
 * 13h56 -> 56
 */
fip.Son.prototype.minutes = function() {
	return parseInt(this.heure().substring(3));
}

/**
 * Le son précédent chronologiquement
 */
fip.Son.prototype.previous = function() {
	var next = this.$div.next();
	if (!next || next.length == 0) return null;
	return new fip.Son(next, this.jour); // TODO : perf OK ?
}

/**
 * Le son suivant chronologiquement
 */
fip.Son.prototype.next = function() {
	var prev = this.$div.prev();
	if (!prev || prev.length == 0) return null;
	return new fip.Son(prev, this.jour); // TODO : perf OK ?
}

/**
 * en minutes
 */
fip.Son.prototype.duree = function() {
	var next = this.next();
	if (next) {
		return next.minutes() - this.minutes();
	}
	else {
		// Par défaut on estime que le son se termine au début de l'heure suivante
		// FIXME : que faire si le son est le son actuellement en diffusion ?
		console.log('Par défaut on estime que le son se termine au début de l\'heure suivante : ' + this.toString());
		return 60 - this.minutes();
	}
}

fip.Son.prototype.toString = function() {
	return this.artiste() + ' - ' + this.titre();
}

/**
 * Pour utilisation dans le HTML : son-2015-06-22-15h03 (22 juin à 15h03)
 *
 * Exemple pour récup tous les div liés au son dans la grille : var sonDivs = fip.$('.'+son.id());
 */
fip.Son.prototype.id = function() {
	return 'son-' + this.jour + '-' + this.heure();
}

/**
 * tous les div qui concerne ce son
 */
fip.Son.prototype.$ = function() {
	return fip.$('.'+fip.Grid.Creneau.CSS_CLASS+' .'+this.id());
}

/**
 * show() sur tous les div qui concerne ce son
 */
fip.Son.prototype.show = function() {
	this.$().show();
}

/**
 * hide() sur tous les div qui concerne ce son
 */
fip.Son.prototype.hide = function() {
	this.$().hide();
}

/**
 * Morceau dans la bibliothèque iTunes.
 * cf : itunes.get()
 */
fip.Son.prototype.itunes = function() {
	var son = this;
	
	if (!son._itunes) {
		itunes.get(this, function(res) {
			son._itunes = res;
		});
		
		var start = new Date();
		while(!son._itunes && (new Date() - start < 10000)) { // TimeOut : 10s
			// attente
		}
		
		if (!son._itunes) {
			console.error('TimeOut pour la recherche du son sur iTunes');
			return null;
		}
	}
	
	return son._itunes;
}



fip.Son.Image = function(div) {
	if (!div || !div.getAttribute) return;
	
	this.div = div;
}

fip.Son.Image.DEFAULT_SRC = 'http://www.fipradio.fr/sites/all/modules/fip/fip_direct/images/direct_default_cover.png';

fip.Son.Image.prototype.src = function() {
	return this.div.getAttribute('src');
}

fip.Son.Image.prototype.isDefault = function() {
	return this.src() === this.DEFAULT_SRC;
}



fip.Grid = function() {
}

/**
 * Grille pour un créneau horaire d'une journée donnée
 * var c = new fip.Grid.Creneau($('.grid-song'))
 
 * Exemple pour créer un créneau pré-rempli (le 23 juin à 9h) :
 *		c = new fip.Grid.Creneau('2015-06-23',9).fill();
 *
 * @param {string} jour
 * @param {number} heure
 * @param {Element} div (si absent sera créé en tête de page avec tous les sons déjà remplis en Ajax)
 */
fip.Grid.Creneau = function(jour, heure, div) {

	// Aucun param
	if (!jour && !heure) {
		var now = new Date();
		var yyyy = now.getYear()+1900;
		var mm = now.getMonth()+1;
		if (mm < 10) mm = '0'+mm;
		var dd = now.getDate();
		if (dd < 10) dd = '0'+dd;
		jour = yyyy+'-'+mm+'-'+dd;
		heure = now.getHours();
	}

	// Param jour absent
	if (typeof jour === 'number' && typeof div === 'undefined') {
		div = heure;
		heure = jour;
		jour = fip.jour();
	}

	var $div;
	if (!div) {
		div = '<div class="'+fip.Grid.Creneau.CSS_CLASS+'"><h2>'+jour+' '+heure+'h</h2><div class="grid-song-heures"></div><div class="grid-song-sons"></div></div>';
		$div = fip.$(div);
		var parent = fip.$('#block-system-main > .content');
		if (!parent || parent.size() == 0) throw new Error('Impossible de créer dynamiquement le créneau car on ne trouve pas le parent qui le recevra : ' + '#block-system-main > .content');
		$div.prependTo(parent);
	}
	else {
		$div = fip.$(div);
	}
	this.$div = $div;
	
	this.jour = jour;
	this.heure = heure;
	
	// heures
	this.$heures = fip.$('.grid-song-heures', $div);
	if (!this.$heures || this.$heures.size() == 0) throw new Error("Le div du créneau horaire doit contenir un DIV de classe 'grid-song-heures' contenant les heures/minutes de chaque titre");
	
	// sons
	this.$sons = fip.$('.grid-song-sons', $div);
	if (!this.$sons || this.$sons.size() == 0) throw new Error("Le div du créneau horaire doit contenir un DIV de classe 'grid-song-sons' contenant les pochettes de chaque titre");
	
	// RAZ
	this.clear();
}

fip.Grid.Creneau.CSS_CLASS = 'grid-song';

/**
 * @param son : un ou plusieurs son
 * g.add(sons[0])
 */
// TODO : l'idéal serait de pouvoir générer le code Javascript (qui génère le div) depuis un fichier HTML (compilation) pour faciliter le maquettage
fip.Grid.Creneau.prototype.add = function(son) {
	if (son instanceof Array) {
		var sons = son;
		var creneau = this;
		sons.forEach(function(son) {
			creneau.add(son);
		});
		return;
	}
	if (!son instanceof fip.Son) return;
	
	var m = son.minutes();
	if (this.sons[m]) {
		console.warn('Son déjà ajouté : ' + son.toString());
		return;
	}
	var d = son.duree();
	
	var left  = m / .6; // % du div parent qui fait une heure (60 minutes)
	var width = d / .6; // (idem)
	var id = son.id();
	var src = son.image.src();
	var vidLink = son.youtube || youtube.getSearchLink(son); // Si le lien direct est connu on l'utilise
	
	// L'id est utilisé en tant que class pour permettre d'ajouter plusieurs instance du même son
	// Exemple pour récupérer le sonsDiv après coup : var sonsDiv = fip.$('.son-2015-06-24-18h54');
	var heuresDiv = fip.$('<div class="grid-song-heure '+id+'" style="left: '+left+'%;">'+m+'</div>'); // TODO : 1er titre -> "13h" au lieu de "00"
	var sonsDiv   = fip.$('<a href="'+vidLink+'" target="youtube"><div class="grid-son '+id+'" style="left: '+left+'%; width: '+width+'%;" title="'+son.toString()+'"><img src="'+src+'"></div></a>');
	
	this.$heures.append(heuresDiv);
	this.$sons.append(sonsDiv);
	
	// Events
	sonsDiv.click(function() {
		// TODO : gestion de l'action dynamique quand on clique sur la pochette du son dans la grille
	});
	sonsDiv.hover(function() {
		// Affichage du son (div original) dans les details
		fip.details().html(son.$div);
	});
	
	this.sons[m] = son;
}

/**
 * supprimer tous les sons ajoutés par add(son)
 */
fip.Grid.Creneau.prototype.clear = function() {
	this.$heures.empty();
	this.$sons.empty();
	this.sons = [];
}
fip.Grid.Creneau.prototype.empty = fip.Grid.Creneau.prototype.clear;

/**
 * Récup dynamique des sons (cf fip.eachSon)
 */
fip.Grid.Creneau.prototype.eachSon = function(callback) {
	fip.eachSon(this.jour, this.heure, callback);
}

/**
 * Ajout dynamique de tous les sons trouvés pour ce créneau (cf eachSon)
 */
fip.Grid.Creneau.prototype.fill = function(callback) {
	var c = this;
	c.eachSon(function(son) {
		c.add(son);
	});
	return this;
}

/**
 * C'est le créneau courant ?
 */
fip.Grid.Creneau.prototype.date = function() {
	return fip.date(this.jour, this.heure);
}

/**
 * C'est le créneau courant ?
 */
fip.Grid.Creneau.prototype.isCurrent = function() {
	var diff = (new Date() - this.date()) / 3600000; // heure écoulée depuis (diff < 1 <=> créneau courant)
	return diff < 1;
}

/**
 * Affiche uniquement les sons dans l'intervall de temps [finMin;debutMax]
 * exemple : c.show(new Date('2015-06-23T15:13+0200'), new Date('2015-06-23T15:27+0200'))
 */
fip.Grid.Creneau.prototype.show = function(finMin, debutMax) {
	var showAll = !finMin && !debutMax;
	this.sons.forEach(function(son) {
		if (showAll) {
			son.show();
			return;
		}
		
		var deb = son.date();
		var fin = new Date(deb); // TODO : optimisation en utilisant la date du next son ? ou bien ?
		fin.setMinutes(fin.getMinutes() + son.duree());
		if ((!debutMax || deb <= debutMax) &&
		    (!finMin   || fin >= finMin))
			son.show();
		else
			son.hide();
	});
}

/**
 * "grid-creneau-2015-06-23-15h"
 */
fip.Grid.Creneau.prototype.id = function() {
	return 'grid-creneau-'+this.jour+'-'+this.heure+'h';
}




var youtube = {};

/**
 * @param txt {String} ou {fip.Son} dans ce cas ou cherche "artiste titre"
 * Recherche d'une requête sur YouTube
 */
youtube.getSearchLink = function(txt) {
	// Si txt est un Son
	if (txt instanceof fip.Son) txt = txt.artiste() + ' ' + txt.titre();

	// txt : EMILIANA TORRINI Wednesday's child
	// enc : EMILIANA+TORRINI+Wednesday%27s+child
	// encodeURI(txt)          -> EMILIANA%20TORRINI%20Wednesday's%20child
	// encodeURIComponent(txt) -> EMILIANA%20TORRINI%20Wednesday's%20child
	// escape(txt)             -> EMILIANA%20TORRINI%20Wednesday%27s%20child
	
	// enc : EMILIANA+TORRINI%2520Wednesday%2527s%2520child
	var encoded = escape(txt).replace(/%20/gi, '+');
	
	return 'https://www.youtube.com/results?search_query='+encoded;
}





var itunes = {};

/**
 * callback(results[])
 */
itunes.search = function(txt, callback) {
	console.time('iTunes + callback');
	fip.$.getJSON("https://itunes.apple.com/search?callback=?", {
		country: 'FR',
		media: 'music',
		entity: 'musicTrack',
		term: txt
	}, function (data) {
		if (data.results.length > 0) {
			callback(data.results);
		} else {
			console.error('No match found in iTunes for track information specified. Query = '+txt);
			callback(data.results);
		}
		console.timeEnd('iTunes + callback');
	});
}

/**
 * {fip.Son} son
 * callback(result) (le seul result qui matche la recherche et la pochette FIP)
 * return (vide)
 */
itunes.get = function(son, callback) {
	if (!son instanceof fip.Son) return;
	
	var query = son.artiste() + ' ' + son.titre();
	var pochetteFip = son.image.src();
	var song = null;
	this.search(query, function(results) {
		if (!results || results.length === 0) {
			return;
		}
	
		// On prend uniquement le titre qui correspond à la pochette d'album utilisée par FIP
		var goodPochettes = [];
		results.forEach(function(res) {
			if (res.artworkUrl100 === pochetteFip) {
				goodPochettes.push(res);
			}
		});
		
		// Aucune pochette correspondante ?
		if (goodPochettes.length === 0) {
			console.error('Aucune pochette ne correspond à celle utilisée par FIP parmis les '+results.length+' résultat(s) iTunes. Pochette FIP : '+pochetteFip);
			return;
		}
		else if (goodPochettes.length === 1) {
			callback(goodPochettes[0]);
			return;
		}
		
		// Plusieurs ?
		var goodTitreLength = [];
		var titreLength = son.titre().length;
		goodPochettes.forEach(function(res) {
			if (res.trackName && res.trackName.length === titreLength) {
				goodTitreLength.push(res);
			}
		});
		
		// Aucun titre (longueur) correspondant ?
		if (goodTitreLength.length === 0) {
			console.error('Aucun titre ne correspond à celui utilisé par FIP parmis les '+goodPochettes.length+' résultat(s) iTunes qui porte la bonne pochette : ');
			console.dir(goodPochettes);
			return;
		}
		else if (goodTitreLength.length === 1) {
			callback(goodTitreLength[0]);
			return;
		}
		
		console.error('Impossible de différencier quel est le bon titre parmi :');
		console.dir(goodTitreLength);
	});
}




// http://www.fipradio.fr/archives-antenne?start_date=2015-06-22&start_hour=13
//importJS();

importCSS("https://raw.githubusercontent.com/Bludwarf/FIP/master/styles.css");

// Création du créneau
//var jour = '2015-06-22';
var c = new fip.Grid.Creneau().fill();

// Exports (pour GreaseMonkey)
window.fip = fip;