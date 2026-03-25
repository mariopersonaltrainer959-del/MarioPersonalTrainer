/**
 * Script para verificar usuarios existentes en la base de datos
 * 
 * Uso: node utils/check-users.js
 */

const { allQuery } = require('./db');

async function checkUsers() {
  try {
    const users = await allQuery('SELECT id, email, name, created_at FROM users ORDER BY created_at DESC');
    
    if (users.length === 0) {
      console.log('\n📭 No hay usuarios en la base de datos.');
      console.log('   Ejecuta: node utils/create-first-user.js\n');
    } else {
      console.log(`\n✅ Se encontraron ${users.length} usuario(s):\n`);
      users.forEach((user, index) => {
        console.log(`${index + 1}. Email: ${user.email}`);
        console.log(`   Nombre: ${user.name}`);
        console.log(`   Creado: ${user.created_at}\n`);
      });
    }
  } catch (error) {
    console.error('❌ Error verificando usuarios:', error.message);
    console.error('   Asegúrate de que la base de datos esté inicializada.');
  }
  process.exit(0);
}

checkUsers();
