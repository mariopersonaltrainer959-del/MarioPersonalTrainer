const readline = require('readline');
const bcrypt = require('bcryptjs');
const { runQuery, getQuery } = require('./db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createUser() {
  console.log('\n🔐 CREACIÓN DE USUARIO DEL NEGOCIO\n');
  console.log('Este usuario tendrá acceso al dashboard para gestionar citas y configuración.\n');

  const email = await question('Email del usuario: ');
  
  // Verificar si el email ya existe
  const existingUser = await getQuery('SELECT id FROM users WHERE email = ?', [email]);
  if (existingUser) {
    console.log('❌ Este email ya está registrado.');
    rl.close();
    return;
  }

  const name = await question('Nombre del usuario: ');
  const password = await question('Contraseña: ');
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

  try {
    await runQuery(
      'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
      [email, hashedPassword, name]
    );
    console.log('\n✅ Usuario creado correctamente!');
    console.log(`   Email: ${email}`);
    console.log('\n📝 Ahora puedes iniciar sesión en el dashboard con estas credenciales.');
  } catch (error) {
    console.error('❌ Error creando usuario:', error.message);
  }

  rl.close();
}

createUser();
