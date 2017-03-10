
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
