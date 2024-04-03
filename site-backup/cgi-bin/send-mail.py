from email.mime.text import MIMEText
from subprocess import Popen, PIPE
from cgi import FieldStorage
form = FieldStorage()
msg = MIMEText(form.getvalue('msg'))
msg['From'] = 'noreply@gournet.co'
msg['To'] = 'office@gournet.co'
msg['Subject'] = '%s (%s): %s' % (form.getvalue('name'), form.getvalue('email'), form.getvalue('subject'))
p = Popen(['/usr/sbin/sendmail', '-t', '-oi'], stdin=PIPE)
p.communicate(msg.as_string().encode('utf-8'))
print('Content-type: text/html\n\n')
print("<h1>Poruka poslata! Hvala Vam!</h1>")
print('<meta http-equiv="refresh" content="3; url=https://gournet.co">')
