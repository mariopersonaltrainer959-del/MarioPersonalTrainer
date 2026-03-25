const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getQuery } = require('../utils/db');
const { requireGuest } = require('../middleware/auth');

// Login
router.get('/login', requireGuest, (req, res) => {
  res.sendFile('login.html', { root: './views' });
});

router.post('/login', requireGuest, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const user = await getQuery('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Crear sesión (negocio_id para multi-negocio)
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userName = user.name;
    req.session.negocioId = user.negocio_id != null ? user.negocio_id : 1;

    res.json({ 
      success: true, 
      message: 'Login exitoso',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el login' });
  }
});

module.exports = router;
