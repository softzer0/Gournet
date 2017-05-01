#!/usr/bin/python3

from re import compile
prog = compile('^(?:(?P<key>msgid(?:_plural)?|msgstr|msgctxt)(?:\[(?P<i>\d)\])? )?"(?P<value>.*?)"$')
def extract_strings(lines):
	c = {}
	o = []
	last = None
	def checkappend(c, o, last, m=False):
		if len(o) == 0 or not m and (last in o[-1] or last == 'msgctxt') or m and last[0] in o[-1]:
			if len(c) > 0:
				o.append({'#': c.copy()})
				c.clear()
			else:
				o.append({})
	for l in lines:
		if l.strip() == '':
			continue
		r = prog.match(l)
		if not r:
			if l[0] == '#':
				if len(l) > 2 and l[2] == ' ':
					l = [l[1], l[3:-1]]
				else:
					l = ['', l[2:-1]]
				if l[0] not in c:
					c[l[0]] = [l[1]]
				else:
					c[l[0]].append(l[1])
			continue
		if r.group('i') or not r.group('key') and isinstance(last, list):
			if not r.group('i'):
				o[-1][last[0]][last[1]].append(r.group('value'))
			elif r.group('key') in o[-1] and r.group('i') not in o[-1][last[0]]:
				last[1] = r.group('i')
				o[-1][last[0]][last[1]] = [r.group('value')]
			else:
				last = [r.group('key'), r.group('i')]
				checkappend(c, o, last, True)
				o[-1][last[0]] = {last[1]: [r.group('value')]}
		else:
			if not r.group('key'):
				o[-1][last].append(r.group('value'))
			else:
				last = r.group('key')
				checkappend(c, o, last)
				o[-1][last] = [r.group('value')]
	if len(c) > 0:
		o[-1]['#'] = c
	return o

def output_strings(lst, file):
	def gen(s, f, i=None):
		out = f+('['+i+'] ' if i else ' ')
		for l in (s[f][i] if i else s[f]):
			out += '"'+l+'"\n'
		return out
	for s in lst:
		out = ''
		if '#' in s:
			for t in sorted(s['#'], key=lambda x: 0 if x == '' else 1 if x == ':' else 2 if x == ',' else 3):
				for i in s['#'][t]:
					out += '#'+t+' '+i+'\n'
		for t in ('msgctxt', 'msgid', 'msgid_plural'):
			if t in s:
				out += gen(s, t)
		if isinstance(s['msgstr'], list):
			out += gen(s, 'msgstr')
		else:
			for t in range(0, len(s['msgstr'].keys())):
				out += gen(s, 'msgstr', str(t))
		file.write(out+'\n')

def main(source, target):
	for s in source:
		for s1 in target:
			if ''.join(s['msgid']) == ''.join(s1['msgid']) and ''.join(s.get('msgctxt', [])) == ''.join(s1.get('msgctxt', [])) and ''.join(s.get('msgid_plural', [])) == ''.join(s1.get('msgid_plural', [])):
				s1['msgstr'] = s['msgstr']

def sync(source, target):
	target = open(target, 'r')
	with target as f:
		data = extract_strings(f.readlines())
	with open(source, 'r') as f:
		main(extract_strings(f.readlines()), data)

	with open(target.name, 'w') as f:
		output_strings(data, f)