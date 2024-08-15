const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const dotenv = require('dotenv');
dotenv.config({ path: './env/.env' });

app.use('/resource', express.static('public'));
app.use('/resource', express.static(__dirname + '/public'))

app.set('view engine', 'ejs');
const bcryptjs = require('bcryptjs');

const session = require('express-session');
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

const connection = require('./database/db');

app.get('/login', (req, res) => {
    res.render('login');
})

app.get('/register', (req, res) => {
    res.render('register');
})

app.post('/register', async (req, res) => {
    const user = req.body.user;
    const name = req.body.name;
    const rol = req.body.rol;
    const pass = req.body.pass;

        // Verificar si el usuario ya existe
        connection.query('SELECT * FROM users WHERE user = ?', [user], async (error, results) => {
            if (error) {
                console.log(error);
            } else if (results.length > 0) {
                // Si el usuario ya existe, enviar una alerta
                res.render('register', {
                    alert: true,
                    alertTitle: "Error",
                    alertMessage: "El usuario ya está en uso.",
                    alertIcon: "error",
                    showConfirmButton: false,
                    timer: 1500,
                    ruta: ''
                });
            } else {
                // Si el usuario no existe, proceder con la inserción
                let passwordHaash = await bcryptjs.hash(pass, 8);
                connection.query('INSERT INTO users SET ?', { user: user, name: name, rol: rol, pass: passwordHaash }, (error, results) => {
                    if (error) {
                        console.log(error);
                    } else {
                        res.render('register', {
                            alert: true,
                            alertTitle: "Registration",
                            alertMessage: "¡Registro exitoso!",
                            alertIcon: "success",
                            showConfirmButton: false,
                            timer: 1500,
                            ruta: ''
                        });
                    }
                });
            }
        });
    });

    app.post('/auth', async (req, res) => {
        const user = req.body.user;
        const pass = req.body.pass;
    
        if (user && pass) {
            connection.query('SELECT * FROM users WHERE user = ?', [user], async (error, results) => {
                if (error) {
                    console.log(error);
                    res.render('login', {
                        alert: true,
                        alertTitle: "Error",
                        alertMessage: 'Error en la base de datos',
                        alertIcon: 'error',
                        showConfirmButton: true,
                        timer: false,
                        ruta: 'login'
                    });
                } else if (results.length == 0 || !(await bcryptjs.compare(pass, results[0].pass))) {
                    res.render('login', {
                        alert: true,
                        alertTitle: "Error",
                        alertMessage: 'Usuario y/o contraseña incorrectos',
                        alertIcon: 'error',
                        showConfirmButton: true,
                        timer: false,
                        ruta: 'login'
                    });
                } else {
                    req.session.loggedin = true;
                    req.session.name = results[0].name;
                    req.session.rol = results[0].rol; // Guarda el rol en la sesión
    
                    let redirectPath = results[0].rol === 'aseguradora' ? '/create-order' : '/';
                    
                    res.render('login', {
                        alert: true,
                        alertTitle: "Conexión exitosa",
                        alertMessage: '¡Login Correcto!',
                        alertIcon: 'success',
                        showConfirmButton: false,
                        timer: 1500,
                        ruta: 'create-order'
                    });
                }
            });
        } else {
            res.render('login', {
                alert: true,
                alertTitle: "Advertencia",
                alertMessage: 'Por favor ingrese un usuario y/o contraseña',
                alertIcon: 'warning',
                showConfirmButton: true,
                timer: 1500,
                ruta: 'login'
            });
        }
    });
    

app.get('/', (req, res) => {
    if (req.session.loggedin) {
        res.render('index', {
            login: true,
            name: req.session.name
        });
    } else {
        res.render('index', {
            login: false,
            name: 'Debe iniciar sesión',
        });
    }
    res.end();
});

app.get('/logout', (req,res)=>{
    req.session.destroy(()=>{
        res.redirect('login')
    })
})

////////////////

app.get('/create-order', (req, res) => {
    if (req.session.loggedin) {
        connection.query('SELECT rol FROM users WHERE name = ?', [req.session.name], (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error en la base de datos');
            }

            if (results.length > 0 && results[0].rol === 'aseguradora') {
                res.render('create-order', {
                    login: true,
                    name: req.session.name
                });
            } else {
                res.redirect('/'); // Usuario no autorizado
            }
        });
    } else {
        res.redirect('/login'); // No autenticado
    }
});

// Ruta para procesar la creación de órdenes
app.post('/create-order', (req, res) => {
    const {
        username,
        workshop_type,
        description,
        brand,
        model,
        year,
        chassis_number,
        license_plate,
        color,
        owner_name,
        owner_phone
    } = req.body;

    // Buscar el user_id basado en el username
    connection.query('SELECT user_id FROM users WHERE user = ?', [username], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error en la base de datos');
        }

        if (results.length > 0) {
            const user_id = results[0].user_id;

            // Insertar la nueva orden de trabajo
            connection.query('INSERT INTO work_orders SET ?', {
                user_id,
                workshop_type,
                description
            }, (err, results) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Error al crear la orden de trabajo');
                }

                const work_order_id = results.insertId;

                // Insertar el coche asociado con la orden de trabajo
                connection.query('INSERT INTO cars SET ?', {
                    work_order_id,
                    brand,
                    model,
                    year,
                    chassis_number,
                    license_plate,
                    color,
                    owner_name,
                    owner_phone
                }, (err) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send('Error al crear el coche');
                    }

                    res.send('Orden de trabajo y coche creados con éxito');
                });
            });
        } else {
            res.status(404).send('Usuario no encontrado');
        }
    });
});







app.listen(3000, (req, res) => {
    console.log('SERVER RUNNING IN http://localhost:3000');
})