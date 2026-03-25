/**
 * Script para crear el primer usuario en producción
 * 
 * Este script verifica si ya existen usuarios y solo crea uno si la BD está vacía.
 * Útil para el despliegue inicial en Railway/Render.
 * 
 * Uso: node utils/create-first-user.js
 */

const readline = require('readline');
const bcrypt = require('bcryptjs');
const { runQuery, getQuery, allQuery } = require('./db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createFirstUser() {
  try {
    // Verificar si ya hay usuarios
    const existingUsers = await allQuery('SELECT COUNT(*) as count FROM users');
    const userCount = existingUsers[0]?.count || 0;

    if (userCount > 0) {
      console.log(`\n✅ Ya existen ${userCount} usuario(s) en la base de datos.`);
      console.log('Si quieres crear otro usuario, usa: node utils/create-user.js\n');
      rl.close();
      return;
    }

    console.log('\n🔐 CREACIÓN DEL PRIMER USUARIO DEL NEGOCIO\n');
    console.log('Este será el usuario administrador con acceso al dashboard.\n');

    const email = await question('Email del usuario: ');
    
    // Verificar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Email inválido.');
      rl.close();
      return;
    }

    // Verificar si el email ya existe (por si acaso)
    const existingUser = await getQuery('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      console.log('❌ Este email ya está registrado.');
      rl.close();
      return;
    }

    const name = await question('Nombre del usuario: ');
    const password = await question('Contraseña (mínimo 6 caracteres): ');
    const confirmPassword = await question('Confirmar contraseña: ');

    if (password !== confirmPassword) {
      console.log('❌ Las contraseñas no coinciden.');
      rl.close();
      return;
    }

    if (password.length < 6) {
      console.log('❌ La contraseña debe tener al menos 6 caracteres.');
      rl.close();
      return;
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    await runQuery(
      'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
      [email, hashedPassword, name]
    );

    console.log('\n✅ Usuario creado correctamente!');
    console.log(`   Email: ${email}`);
    console.log(`   Nombre: ${name}`);
    console.log('\n📝 Ahora puedes iniciar sesión en el dashboard con estas credenciales.');
    console.log('   URL: http://tu-dominio.com/dashboard\n');
  } catch (error) {
    console.error('❌ Error creando usuario:', error.message);
  } finally {
    rl.close();
  }
}

createFirstUser();
