const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("ALTER TABLE user_profile ADD COLUMN welcome_message TEXT", () => {
    db.run("UPDATE user_profile SET name='Siddhi Patil', welcome_message='Welcome to my portfolio!' WHERE id=1", (err) => {
      if(err) console.error(err);
      else console.log('Updated db successfully');
    });
  });
});
