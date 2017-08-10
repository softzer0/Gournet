

(function(globals) {

  var django = globals.django || (globals.django = {});

  
  django.pluralidx = function(n) {
    var v=n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2;
    if (typeof(v) == 'boolean') {
      return v ? 1 : 0;
    } else {
      return v;
    }
  };
  

  /* gettext library */

  django.catalog = django.catalog || {};
  
  var newcatalog = {
    "%(sel)s of %(cnt)s selected": [
      "%(sel)s od %(cnt)s izabran",
      "%(sel)s od %(cnt)s izabrana",
      "%(sel)s od %(cnt)s izabranih"
    ],
    "(Custom)": "(Osobeno)",
    "15 minutes": "15 minuta",
    "2 days": "2 dana",
    "2 hours": "2 sata",
    "3 days": "3 dana",
    "3 hours": "3 sata",
    "4 days": "4 dana",
    "4 hours": "4 sata",
    "45 minutes": "45 minuta",
    "5 days": "5 dana",
    "5 hours": "5 sata",
    "6 a.m.": "18\u010d",
    "6 days": "6 dana",
    "; <strong>{{ e.friend_count[1] }}</strong> mutual friend": [
      "; <strong>{{ e.friend_count[1] }}</strong> zajedni\u010dki prijatelj",
      "; <strong>{{ e.friend_count[1] }}</strong> zajedni\u010dka prijatelja",
      "; <strong>{{ e.friend_count[1] }}</strong> zajedni\u010dkih prijatelja"
    ],
    "; no mutual friends": "; nema zajedni\u010dkih prijatelja",
    "; supported currency:": [
      "; podr\u017eana valuta:",
      "; podr\u017eane valute:",
      "; podr\u017eane valute:"
    ],
    "; {{ e.item_count }} item": [
      "; {{ e.item_count }} proizvod",
      "; {{ e.item_count }} proizvoda",
      "; {{ e.item_count }} proizvoda"
    ],
    "<a href=\"javascript:\" ng-click=\"showFavouritesModal()\"><i class=\"fa fa-heart\"></i> <strong>{{ fav_count }}</strong></a> person has favored this": [
      "<a href=\"javascript:\" ng-click=\"showFavouritesModal()\"><i class=\"fa fa-heart\"></i> <strong>{{ fav_count }}</strong></a> osoba je favorizovala ovo",
      "<a href=\"javascript:\" ng-click=\"showFavouritesModal()\"><i class=\"fa fa-heart\"></i> <strong>{{ fav_count }}</strong></a> osobe su favorizovale ovo",
      "<a href=\"javascript:\" ng-click=\"showFavouritesModal()\"><i class=\"fa fa-heart\"></i> <strong>{{ fav_count }}</strong></a> osoba je favorizovalo ovo"
    ],
    "<a href=\"javascript:\" ng-click=\"showFriendsModal()\"><i class=\"fa fa-users\"></i> <strong>{{ $parent.u.friend_count }}</strong></a> friend": [
      "<a href=\"javascript:\" ng-click=\"showFriendsModal()\"><i class=\"fa fa-users\"></i> <strong>{{ $parent.u.friend_count }}</strong></a> prijatelj",
      "<a href=\"javascript:\" ng-click=\"showFriendsModal()\"><i class=\"fa fa-users\"></i> <strong>{{ $parent.u.friend_count }}</strong></a> prijatelja",
      "<a href=\"javascript:\" ng-click=\"showFriendsModal()\"><i class=\"fa fa-users\"></i> <strong>{{ $parent.u.friend_count }}</strong></a> prijatelja"
    ],
    "<a ng-href=\"/user/{{ e.friend.username }}/\"><strong>{{ e.friend.first_name }} {{ e.friend.last_name }}</strong></a> gave {{ e.friend.status == 1 ? 'like' : 'dislike' }} to:": "<a ng-href=\"/user/{{ e.friend.username }}/\"><strong>{{ e.friend.first_name }} {{ e.friend.last_name }}</strong></a> ka\u017ee da mu/joj se {{ e.friend.status == 1 ? 'svi\u0111a' : 'ne svi\u0111a' }} ovo:",
    "<a ng-href=\"/user/{{ e.friend.username }}/\"><strong>{{ e.friend.first_name }} {{ e.friend.last_name }}</strong></a> gave {{ e.friend.status }} star to:": [
      "<a ng-href=\"/user/{{ e.friend.username }}/\"><strong>{{ e.friend.first_name }} {{ e.friend.last_name }}</strong></a> je dao/la {{ e.friend.status }} zvezdicu ovome:",
      "<a ng-href=\"/user/{{ e.friend.username }}/\"><strong>{{ e.friend.first_name }} {{ e.friend.last_name }}</strong></a> je dao/la {{ e.friend.status }} zvezdice ovome:",
      "<a ng-href=\"/user/{{ e.friend.username }}/\"><strong>{{ e.friend.first_name }} {{ e.friend.last_name }}</strong></a> je dao/la {{ e.friend.status }} zvezdica ovome:"
    ],
    "<a ng-href=\"/user/{{ e.friend.username }}/\"><strong>{{ e.friend.first_name }} {{ e.friend.last_name }}</strong></a> {{ e.when !== undefined ? 'posted' : e.price !== undefined ? 'added' : e.created !== undefined ? 'reviewed' : e.target !== undefined ? 'became a friend to' : 'favored' }}:": "<a ng-href=\"/user/{{ e.friend.username }}/\"><strong>{{ e.friend.first_name }} {{ e.friend.last_name }}</strong></a> je {{ e.when !== undefined ? 'objavio/la' : e.price !== undefined ? 'dodao/la' : e.created !== undefined ? 'ostavio/la recenziju' : e.target !== undefined ? 'postao prijatelj/prijateljica sa' : 'favorizovao/la' }}:",
    "A day": "dan",
    "A week": "nedelju dana",
    "Accept friend request": "Prihvati zahtev za prijateljstvo",
    "Add Email Address": "Dodaj email adresu",
    "After changing the %s for the first time, you won't be able to do that again.": "Nakon menjanja %s po prvi put, ne\u0107ete mo\u0107i to uraditi ponovo.",
    "Alcoholic beverages": "Alkoholna pi\u0107a",
    "An hour": "sat",
    "Are you sure that you want to continue?": "Da li ste sigurni da \u017eelite nastaviti?",
    "Are you sure that you want to delete this event?": "Da li ste sigurni da \u017eelite obrisati ovaj doga\u0111aj?",
    "Are you sure that you want to delete this item?": "Da li ste sigurni da \u017eelite obrisati ovaj proizvod?",
    "Are you sure that you want to delete this review?": "Da li ste sigurni da \u017eelite obrisati ovu recenziju?",
    "Are you sure that you want to remove email <strong>%s</strong>?": "Da li ste sigurni da \u017eelite obrisati email <strong>%s</strong>?",
    "Are you sure?": "Da li ste sigurni?",
    "Available %s": "Dostupni %s",
    "Beers": "Piva",
    "Born {{ edit.birth.value | ageFilter }} years ago": [
      "Ro\u0111en/a pre {{ edit.birth.value | ageFilter }} godinu",
      "Ro\u0111en/a pre {{ edit.birth.value | ageFilter }} godine",
      "Ro\u0111en/a pre {{ edit.birth.value | ageFilter }} godina"
    ],
    "Breakfasts, appetizers": "Doručak, predjela",
    "Cancel": "Odustani",
    "Cancel friend request": "Otka\u017ei zahtev za prijateljstvo",
    "Choose": "Izaberi",
    "Choose a time": "Odabir vremena",
    "Choose all": "Izaberi sve",
    "Chosen %s": "Izabrano \u201e%s\u201c",
    "Ciders": "Cideri",
    "Click to choose all %s at once.": "Izaberite sve \u201e%s\u201c odjednom.",
    "Click to remove all chosen %s at once.": "Uklonite sve izabrane \u201e%s\u201c odjednom.",
    "Cocktails": "Kokteli",
    "Coffees": "Kafe",
    "Comments (%s)": "Komentari (%s)",
    "Confirmation e-mail has been sent to <span ng-repeat=\"e in sent\">{{ $first ? '' : ', ' }}<strong>{{ e }}</strong></span>.": "E-mail za verifikaciju je upravo poslat na <span ng-repeat=\"e in sent\">{{ $first ? '' : ', ' }}<strong>{{ e }}</strong></span>.",
    "Current password": "Trenutna lozinka",
    "Currently <strong>{{ e.is_opened ? 'opened' : 'closed' }}</strong>": "Trenutno <strong>{{ e.is_opened ? 'otvoreno' : 'zatvoreno' }}</strong>",
    "Desserts": "Dezert",
    "Disiked by": "Ne svi\u0111a se",
    "Drinks": "Pi\u0107a",
    "Edit business info": "Izmeni informacije ugostiteljskog objekta",
    "Email": "Email",
    "Enter new password:": "Unesite novu \u0161ifru:",
    "Enter your current password before changing:": "Unesite Va\u0161u trenutnu lozinku pre menjanja:",
    "Event(s)": "Doga\u0111aji",
    "Events": "Doga\u0111aji",
    "Favoured by": "Favorizovano od strane",
    "Favourites": "Omiljeni",
    "Filter": "Filter",
    "Food": "Hrana",
    "Food additives": "Prilozi",
    "Friends": "Prijatelji",
    "Gins": "D\u017ein",
    "Go to main page.": "Vrati se na po\u010detnu stranicu.",
    "Half a day": "pola dana",
    "Half an hour": "pola sata",
    "Has <a href=\"javascript:\" ng-click=\"$parent.showFriendsModal(e.id || e.target.id)\">{{ e.friend_count[0] }} friend</a>": [
      "Ima <a href=\"javascript:\" ng-click=\"$parent.showFriendsModal(e.id || e.target.id)\">{{ e.friend_count[0] }} prijatelja</a>",
      "Ima <a href=\"javascript:\" ng-click=\"$parent.showFriendsModal(e.id || e.target.id)\">{{ e.friend_count[0] }} prijatelja</a>",
      "Ima <a href=\"javascript:\" ng-click=\"$parent.showFriendsModal(e.id || e.target.id)\">{{ e.friend_count[0] }} prijatelja</a>"
    ],
    "Has no friends": "Nema prijatelja",
    "Hide": "Sakrij",
    "Hot chocolates": "Topla \u010dokolada",
    "If you change the business currency now, then item prices in the menu will be converted to that new currency.": "Ako promenite valutu Va\u0161eg ugostiteljskog objekta sada, onda \u0107e cene proizvoda biti preba\u010dene u tu novu valutu.",
    "Internationalization": "Internacionalizacija",
    "Invalid address.": "Neta\u010dna adresa.",
    "Is my friend": "Moj je prijatelj",
    "Is my friend, too": "Tako\u0111e je i moj prijatelj",
    "Item(s)": "Proizvodi",
    "Items": "Proizvodi",
    "Juices": "Sokovi",
    "Liked by": "Svi\u0111a se",
    "Liqueurs": "Likeri",
    "Load more": "U\u010ditaj jo\u0161",
    "Load newer": "U\u010ditaj novije",
    "Load older": "U\u010ditaj starije",
    "Make Primary": "Napravi primarnim",
    "Meals": "Obroci/jela",
    "Midnight": "Pono\u0107",
    "New password": "Nova \u0161ifra",
    "New password (again)": "Nova \u0161ifra (opet)",
    "New password fields don't match.": "Polja za unos nove \u0161ifre se ne poklapaju.",
    "No": "Ne",
    "No favourites.": "Nema favorita.",
    "No friends.": "Nema prijatelja.",
    "No results.": "Nema rezultata.",
    "Noon": "Podne",
    "Notify (%s)": "Obavesti (%s)",
    "Notify friends": "Obavesti prijatelje",
    "Now": "Trenutno vreme",
    "OK": "U redu",
    "Other": "Ostalo",
    "Other drinks": "Ostala pi\u0107a",
    "Password and email(s)": "\u0160ifra i email-ovi",
    "Password must contain at least 8 characters": "\u0160ifra mora da sadr\u017ei minimum 8 karaktera",
    "Pastas and pastries": "Testenina i testa",
    "Pizzas": "Pice",
    "Please type your current password.": "Molimo unesite Va\u0161u trenutnu \u0161ifru.",
    "Primary": "Primarno",
    "Ratings": "Ocene",
    "Re-send Verification": "Po\u0161alji ponovo verifikaciju",
    "Reactions": "Reakcije",
    "Remind me for this event": "Podseti me na ovaj doga\u0111aj",
    "Remove": "Izbri\u0161i",
    "Remove all": "Ukloni sve",
    "Remove from friends": "Izbaci iz prijatelja",
    "Repeat new password:": "Ponovite novu \u0161ifru:",
    "Review(s)": "Recenzije",
    "Reviews": "Recenzije",
    "Rums": "Rum",
    "Salads": "Salate",
    "Save": "Sa\u010duvaj",
    "Seafood, fish dishes": "Morska hrana, riblja jela",
    "Select friend(s)": "Odaberi prijatelja/e",
    "Set": "Postavi",
    "Settings": "Pode\u0161avanja",
    "Show": "Poka\u017ei",
    "Soft drinks": "Bezalkoholna pi\u0107a",
    "Soups, stews": "Supe, čorbe i sl.",
    "Specified shortname is already taken.": "Data skra\u0107enica je ve\u0107 zauzeta.",
    "Specified shortname is not permitted.": "Data skra\u0107enica nije dozvoljena.",
    "Submit": "Po\u0161alji",
    "Teas": "\u010cajevi",
    "Tequilas": "Tekile",
    "The phone number entered is not valid.": "Uneti broj telefona nije validan.",
    "This is the list of available %s. You may choose some by selecting them in the box below and then clicking the \"Choose\" arrow between the two boxes.": "Ovo je lista dostupnih \u201e%s\u201c. Mo\u017eete izabrati elemente tako \u0161to \u0107ete ih izabrati u listi i kliknuti na \u201eIzaberi\u201c.",
    "This is the list of chosen %s. You may remove some by selecting them in the box below and then clicking the \"Remove\" arrow between the two boxes.": "Ovo je lista izabranih \u201e%s\u201c. Mo\u017eete ukloniti elemente tako \u0161to \u0107ete ih izabrati u listi i kliknuti na \u201eUkloni\u201c.",
    "This message will disappear once your business is approved. When published, it will become visible/accessible to others.": "Ova poruka \u0107e nestati jednom kada Va\u0161 ugostiteljski objekat bude potvr\u0111en. Kada bude objavljen, tada \u0107e biti vidljiv/dostupan ostalima.",
    "Today": "Danas",
    "Tomorrow": "Sutra",
    "Type into this box to filter down the list of available %s.": "Filtrirajte listu dostupnih elemenata \u201e%s\u201c.",
    "Verified": "Verifikovano",
    "Vodkas": "Votke",
    "Whiskeys": "Viski",
    "Wines": "Vina",
    "Working...": "U toku...",
    "Yes": "Da",
    "Yesterday": "Ju\u010de",
    "You can't delete the last remaining item!": "Ne mo\u017eete obrisati posledji preostali proizvod!",
    "You can't upload image larger than 4.5MB!": "Ne mo\u017eete poslati sliku ve\u0107u od 4.5MB!",
    "You don't have any notifications yet.": "Jo\u0161 uvek nemate obave\u0161tenja.",
    "You have currently {{ emails.length }} email address associated with your account:": [
      "Imate trenutno {{ emails.length }} email adresu povezanu sa Va\u0161im nalogom:",
      "Imate trenutno {{ emails.length }} email adrese povezane sa Va\u0161im nalogom:",
      "Imate trenutno {{ emails.length }} email adresa povezanih sa Va\u0161im nalogom:"
    ],
    "You have selected an action, and you haven't made any changes on individual fields. You're probably looking for the Go button rather than the Save button.": "Izabrali ste akciju ali niste izmenili ni jedno polje.",
    "You have selected an action, but you haven't saved your changes to individual fields yet. Please click OK to save. You'll need to re-run the action.": "Izabrali ste akciju ali niste sa\u010duvali promene polja.",
    "You have unsaved changes on individual editable fields. If you run an action, your unsaved changes will be lost.": "Imate nesa\u010divane izmene. Ako pokrenete akciju, izmene \u0107e biti izgubljene.",
    "Your comment": "Va\u0161 komentar",
    "Your favourites": "Va\u0161i favoriti",
    "Your friends": "Va\u0161i prijatelji",
    "Your new password matches the current entered password, choose a different one.": "Va\u0161a nova \u0161ifra se poklapa sa trenutnom, izaberite drugu.",
    "Your password has been changed.": "Va\u0161a \u0161ifra je promenjena.",
    "after changing\u0004birthdate": "datuma ro\u0111enja",
    "after changing\u0004gender": "pola",
    "after changing\u0004name": "imena",
    "and": "i",
    "and {{ e.friend.count }} other friend": [
      "i jo\u0161 {{ e.friend.count }} prijatelj",
      "i jo\u0161 {{ e.friend.count }} prijatelja",
      "i jo\u0161 {{ e.friend.count }} prijatelja"
    ],
    "before certain period of time\u0004before, or:": "pre, ili:",
    "distance\u0004%s away": "%s daleko",
    "from user to which business\u0004, to:": " upu\u0107uje ka:",
    "page\u0004Main": "Po\u010detna",
    "page\u0004Search": "Pretraga",
    "plural\u0004Barbecue": "Ro\u0161tilj",
    "plural\u0004Brandy": "Rakije, vinjaci, konjaci i sl.",
    "plural\u0004Fast food": "Brza hrana",
    "plural\u0004Water": "Voda",
    "they\u0004favoured": "su favorizovali",
    "they\u0004rated": "su ocenili",
    "they\u0004reacted to": "su reagovali na",
    "{{ first_name || 'You' }} gave {{ e.person_status[0] == 1 ? 'like' : 'dislike' }} to:": "{{ first_name !== undefined ? first_name+' ka\u017ee da mu/joj' : 'Ti ka\u017ee\u0161 da ti' }} se {{ e.person_status[0] == 1 ? 'svi\u0111a' : 'ne svi\u0111a' }} ovo:",
    "{{ first_name || 'You' }} gave {{ e.person_status[0] }} star to:": [
      "{{ first_name !== undefined ? first_name+' je' : 'Ti si' }} dao/la {{ e.person_status[0] }} zvezdicu ovome:",
      "{{ first_name !== undefined ? first_name+' je' : 'Ti si' }} dao/la {{ e.person_status[0] }} zvezdice ovome:",
      "{{ first_name !== undefined ? first_name+' je' : 'Ti si' }} dao/la {{ e.person_status[0] }} zvezdica ovome:"
    ],
    "{{ first_name || 'You' }} {{ e.when !== undefined ? 'posted' : e.price !== undefined ? 'added' : 'reviewed' }}:": "{{ first_name !== undefined ? first_name+' je' : 'Ti si' }} {{ e.when !== undefined ? 'objavio/la' : e.price !== undefined ? 'dodao/la' : 'ostavio/la recenziju' }}:"
  };
  for (var key in newcatalog) {
    django.catalog[key] = newcatalog[key];
  }
  

  if (!django.jsi18n_initialized) {
    django.gettext = function(msgid) {
      var value = django.catalog[msgid];
      if (typeof(value) == 'undefined') {
        return msgid;
      } else {
        return (typeof(value) == 'string') ? value : value[0];
      }
    };

    django.ngettext = function(singular, plural, count) {
      var value = django.catalog[singular];
      if (typeof(value) == 'undefined') {
        return (count == 1) ? singular : plural;
      } else {
        return value[django.pluralidx(count)];
      }
    };

    django.gettext_noop = function(msgid) { return msgid; };

    django.pgettext = function(context, msgid) {
      var value = django.gettext(context + '\x04' + msgid);
      if (value.indexOf('\x04') != -1) {
        value = msgid;
      }
      return value;
    };

    django.npgettext = function(context, singular, plural, count) {
      var value = django.ngettext(context + '\x04' + singular, context + '\x04' + plural, count);
      if (value.indexOf('\x04') != -1) {
        value = django.ngettext(singular, plural, count);
      }
      return value;
    };

    django.interpolate = function(fmt, obj, named) {
      if (named) {
        return fmt.replace(/%\(\w+\)s/g, function(match){return String(obj[match.slice(2,-2)])});
      } else {
        return fmt.replace(/%s/g, function(match){return String(obj.shift())});
      }
    };


    /* formatting library */

    django.formats = {
    "DATETIME_FORMAT": "N j, Y, P",
    "DATETIME_INPUT_FORMATS": [
      "%Y-%m-%d %H:%M:%S",
      "%Y-%m-%d %H:%M:%S.%f",
      "%Y-%m-%d %H:%M",
      "%Y-%m-%d",
      "%m/%d/%Y %H:%M:%S",
      "%m/%d/%Y %H:%M:%S.%f",
      "%m/%d/%Y %H:%M",
      "%m/%d/%Y",
      "%m/%d/%y %H:%M:%S",
      "%m/%d/%y %H:%M:%S.%f",
      "%m/%d/%y %H:%M",
      "%m/%d/%y"
    ],
    "DATE_FORMAT": "N j, Y",
    "DATE_INPUT_FORMATS": [
      "%Y-%m-%d",
      "%m/%d/%Y",
      "%m/%d/%y",
      "%b %d %Y",
      "%b %d, %Y",
      "%d %b %Y",
      "%d %b, %Y",
      "%B %d %Y",
      "%B %d, %Y",
      "%d %B %Y",
      "%d %B, %Y"
    ],
    "DECIMAL_SEPARATOR": ".",
    "FIRST_DAY_OF_WEEK": "0",
    "MONTH_DAY_FORMAT": "F j",
    "NUMBER_GROUPING": "0",
    "SHORT_DATETIME_FORMAT": "m/d/Y P",
    "SHORT_DATE_FORMAT": "m/d/Y",
    "THOUSAND_SEPARATOR": ",",
    "TIME_FORMAT": "P",
    "TIME_INPUT_FORMATS": [
      "%H:%M:%S",
      "%H:%M:%S.%f",
      "%H:%M"
    ],
    "YEAR_MONTH_FORMAT": "F Y"
  };

    django.get_format = function(format_type) {
      var value = django.formats[format_type];
      if (typeof(value) == 'undefined') {
        return format_type;
      } else {
        return value;
      }
    };

    /* add to global namespace */
    globals.pluralidx = django.pluralidx;
    globals.gettext = django.gettext;
    globals.ngettext = django.ngettext;
    globals.gettext_noop = django.gettext_noop;
    globals.pgettext = django.pgettext;
    globals.npgettext = django.npgettext;
    globals.interpolate = django.interpolate;
    globals.get_format = django.get_format;

    django.jsi18n_initialized = true;
  }

}(this));

app.config(function ($injector) {
  var s = $injector.get('timeAgoSettings');
  if (s === undefined) return;
  s.strings['sr_Latn'] = {
      prefixAgo: 'pre',
      prefixFromNow: null,
      suffixAgo: null,
      suffixFromNow: 'od ovog trenutka',
      seconds: 'manje od minuta',
      minute: 'oko minut',
      minutes: '%d minuta',
      hour: 'oko jedan sat',
      hours: 'oko %d sata/i',
      day: 'jedan dan',
      days: '%d dana',
      month: 'oko mesec dana',
      months: '%d meseca/i',
      year: 'oko godinu dana',
      years: '%d godina/e',
      numbers: []
  };
  s.overrideLang = 'sr_Latn';
});
