// Small SQLite-backed Map for authentication state that must survive server restarts.
export class PersistentAuthMap {
  constructor(db, namespace) {
    this.db=db;this.namespace=namespace;
    db.exec('CREATE TABLE IF NOT EXISTS auth_runtime_state(namespace TEXT NOT NULL,key TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(namespace,key))');
  }
  get(key){const row=this.db.prepare('SELECT payload FROM auth_runtime_state WHERE namespace=? AND key=?').get(this.namespace,key);return row?JSON.parse(row.payload):undefined;}
  set(key,value){this.db.prepare('INSERT INTO auth_runtime_state VALUES(?,?,?) ON CONFLICT(namespace,key) DO UPDATE SET payload=excluded.payload').run(this.namespace,key,JSON.stringify(value));return this;}
  delete(key){return this.db.prepare('DELETE FROM auth_runtime_state WHERE namespace=? AND key=?').run(this.namespace,key).changes>0;}
  *entries(){for(const row of this.db.prepare('SELECT key,payload FROM auth_runtime_state WHERE namespace=?').all(this.namespace))yield [row.key,JSON.parse(row.payload)];}
  *values(){for(const [,value]of this.entries())yield value;}
}
