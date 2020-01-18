#!/usr/bin/python3

EXT = 'html'
TAG = 'translate'
MSGSTR_NUM = 2

from re import compile
from html.parser import HTMLParser

prog = [compile(r'("|\')(.*?)\1'), compile(r'%(\(.*?\))?s')]
class TemplateParser(HTMLParser):
	recording = 0
	f = [None, '']
	tmp = [None, '']

	def __init__(self, *args, **kwargs):
		self.tag = kwargs.pop('tag')
		self.msgstr_num = kwargs.pop('msgstr_num')
		self.prog = compile(r'\{{2} *([^\s|}]+(?: +[^\s|}]+)*) *\| *'+self.tag+r'(?: *:(?:[^:]*): *(["\'])([^"\'}]*(?:(?!\2)["\'][^"\'}]*)*)\2)?[^}]*\}{2}')
		super().__init__()

	def genc(self):
		return self.f[0][0]+':'+str(self.getpos()[0])

	def retnew(self, s=''):
		return {'#': {':': [self.genc()]}, 'msgid': [s]}

	def appendpos(self, p, s):
		if '#' in s:
			if ':' in s['#']:
				for i in s['#'][':']:
					if p in i:
						return
			else:
				s['#'][':'] = []
		else:
			s['#'] = {':': []}
		for i, _ in enumerate(s['#'][':']):
			if ' '+self.f[0][0] in s['#'][':'][i]:
				s['#'][':'][i] += ' '+p
				return
		s['#'][':'].append(p)

	def repl(self, s):
		if self.f[0][1]:
			s = s.replace('{% verbatim %}', '').replace('{% endverbatim %}', '')
		return s.replace('\\', '\\\\').replace('"', '\\"')

	def extr_filter(self, t):
		for e in self.prog.findall(t):
			r = [prog[1].search(e[0]), None]
			for s in prog[0].findall(e[0]):
				r[1] = self.repl(s[1])
				for i in self.data:
					if 'msgid_plural' not in i and ''.join(i['msgid']) == r[1] and ''.join(i.get('msgctxt', [])) == e[2]:
						self.appendpos(self.genc(), i)
						r[1] = None
						break
				if not r[1]:
					continue
				self.data.append(self.retnew(r[1]))
				if r[0]:
					self.data[-1]['#'][','] = ['javascript-format']
				if e[2] != '':
					self.data[-1]['msgctxt'] = [e[2]]
				self.data[-1]['msgstr'] = ['']

	def handle_starttag(self, tag, attrs):
		s = self.get_starttag_text()
		self.extr_filter(s)
		if self.recording > 0:
			if s == '<br plural>':
				self.f[1] = 'msgid_plural'
				self.tmp[0][self.f[1]] = ['']
				return
			elif tag not in ('br', 'img', 'input', 'hr'):
				self.recording += 1
			self.tmp[0][self.f[1]][0] += self.repl(s)
			return
		for name, _ in attrs:
			if name == self.tag:
				self.tmp[0] = self.retnew()
				self.f[1] = 'msgid'
				self.recording = 1
				break

	def handle_data(self, data):
		self.tmp[1] += data
		if self.recording > 0:
			self.tmp[0][self.f[1]][0] += self.repl(data).replace('\n', '\\n')

	def handle_endtag(self, tag):
		if self.recording > 0:
			self.recording -= 1
			if self.recording == 0:
				for i in self.data:
					if ''.join(i['msgid']) == ''.join(self.tmp[0]['msgid']) and ''.join(i.get('msgid_plural', [])) == ''.join(self.tmp[0].get('msgid_plural', [])):
						self.appendpos(self.tmp[0]['#'][':'][0], i)
						self.tmp[0] = None
						return
				if 'msgid_plural' in self.tmp[0]:
					self.tmp[0]['msgstr'] = {}
					for i in range(0, self.msgstr_num):
						self.tmp[0]['msgstr'][str(i)] = ['']
				else:
					self.tmp[0]['msgstr'] = ['']
				self.data.append(self.tmp[0].copy())
				self.tmp[0] = None
			else:
				self.tmp[0][self.f[1]][0] += '</'+tag+'>'
		self.extr_filter(self.tmp[1])
		self.tmp[1] = ''

	def handle_entityref(self, name):
		self.tmp[1] += '&'+name+';'
		if self.recording > 0:
			self.tmp[0][self.f[1]][0] += '&'+name+';'

def main(target_dir, output_file, source_file=None, overwrite=False, tag=TAG, ext=EXT, msgstr_num=MSGSTR_NUM):
	import os
	from . import sync_po

	parser = TemplateParser(tag=tag, msgstr_num=msgstr_num)

	if not overwrite and os.path.exists(output_file):
		with open(output_file, 'r', encoding='utf8') as f:
			parser.data = sync_po.extract_strings(f.readlines())
	else:
		parser.data = []

	ext = '.'+ext
	for subdir, _, files in os.walk(target_dir):
		for file in files:
			filepath = subdir + os.sep + file
			if filepath.endswith(ext):
				with open(filepath, 'r', encoding='utf8') as f:
					parser.f[0] = (os.path.relpath(filepath, target_dir), os.sep+'static'+os.sep not in filepath)
					parser.feed(f.read())
					parser.reset()

	if source_file and not os.path.samefile(output_file, source_file.name):
		with source_file as f:
			sync_po.main(sync_po.extract_strings(f.readlines()), parser.data)

	with open(output_file, 'w', encoding='utf8') as f:
		sync_po.output_strings(parser.data, f)