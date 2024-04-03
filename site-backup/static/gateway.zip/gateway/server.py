#!/usr/bin/python3
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
from hashlib import pbkdf2_hmac
from os import urandom
from binascii import hexlify
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from bsddb3 import hashopen

def deriveKey(passphrase, salt=None):
    if salt is None:
        salt = urandom(8)
    return pbkdf2_hmac('sha256', passphrase.encode('utf8'), salt, 4096), salt

def encrypt(passphrase, plaintext):
    key, salt = deriveKey(passphrase)
    aes = AESGCM(key)
    iv = urandom(12)
    plaintext = plaintext.encode('utf8')
    ciphertext = aes.encrypt(iv, plaintext, None)
    return '%s-%s-%s' % (hexlify(salt).decode('utf8'), hexlify(iv).decode('utf8'), hexlify(ciphertext).decode('utf8'))

def demask(string):
    p = int(string[1:3])+3
    return int(string[p:p+int(string[:1])])

class MyServer(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            pk = str(demask(self.path[1:]))
            c = str(int(db.get(pk.encode('ascii'), 0)) + 1)
            db[pk.encode('ascii')] = c.encode('ascii')
            db.sync()
            link = 'https://test.gournet.co/'+business+'/?q='+encrypt(secret, '%s,%s' % (pk, c))
        except:
            self.send_response(400)
        else:
            self.send_response(302)
            self.send_header('Location', link)
        finally:
            self.end_headers()

db = hashopen('data.db')
business, secret = db.get(b'business').decode('ascii'), db.get(b'secret').decode('ascii')

class ThreadingSimpleServer(ThreadingMixIn, HTTPServer):
    pass

myServer = ThreadingSimpleServer(('0.0.0.0', 80), MyServer)
try:
    myServer.serve_forever()
except KeyboardInterrupt:
    pass

myServer.server_close()
db.close()
