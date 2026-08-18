import os
from flask import g
import sqlite3

from app import DB_PATH
BG_PATH = os.path.join(os.path.dirname(__file__), 'static', 'backgrounds')
DB_PATH = "votes.db"

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(
            DB_PATH,
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row

    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def query_db(query, args=(), one=False):
    cur = get_db().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv

def modify_db(query, args=()):
    db = get_db()
    cursor = db.execute(query, args)
    db.commit()
    cursor.close()

def init_db():
    db = sqlite3.connect(DB_PATH) 
    
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    with open(schema_path, mode='r') as f:
        db.cursor().executescript(f.read())
        
    db.commit()
    db.close()

def update_db():
    if not os.path.exists(BG_PATH):
        return

    backgrounds = [
        d for d in os.listdir(BG_PATH)
        if os.path.isdir(os.path.join(BG_PATH, d))
    ]

    db = sqlite3.connect(DB_PATH)
    cursor = db.cursor()

    for b in backgrounds:
        cursor.execute(
            "INSERT OR IGNORE INTO backgrounds (bg_name) VALUES (?)",
            (b,)
        )
        
    db.commit()
    db.close()

def get_background_scores(user_ip):
    query = "SELECT background_name, score FROM user_backgrounds WHERE user_ip = ?"
    rows = query_db(query, (user_ip,))
    
    return [tuple(row) for row in rows]

