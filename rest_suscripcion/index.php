<?php

require_once(__DIR__ . '/configuracion/CorsConfig.php');

// Configurar CORS y headers de seguridad globales
CorsConfig::configurar();

// Manejar preflight OPTIONS
CorsConfig::manejarPreflight();

$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);


// Detectar si es la página principal
$esRaiz = ($requestUri === '/' || $requestUri === '/rest_suscripcion/' || $requestUri === '/rest_suscripcion');

// Si es la raíz y viene de un navegador, mostrar página de anuncio
if ($esRaiz) {
    $acceptHeader = $_SERVER['HTTP_ACCEPT'] ?? '';
    $esPeticionNavegador = strpos($acceptHeader, 'text/html') !== false;
    
    if ($esPeticionNavegador) {
        mostrarPaginaAnuncio();
        exit;
    }
}

// Mapeo de rutas más eficiente
$rutas = [
    '/planes' => 'rutas/PlanesRts.php',
    '/suscripcion' => 'rutas/SuscripcionRts.php',
];

$rutaEncontrada = false;

foreach ($rutas as $patron => $archivo) {
    if (strpos($requestUri, $patron) !== false) {
        if (file_exists($archivo)) {
            require_once $archivo;
            $rutaEncontrada = true;
            break;
        } else {
            http_response_code(500);
            echo json_encode([
                "error" => "Archivo de ruta no encontrado",
                "timestamp" => date('c')
            ]);
            exit;
        }
    }
}

if (!$rutaEncontrada) {
    http_response_code(404);
    echo json_encode([
        "error" => "Endpoint no encontrado",
        "mensaje" => "La ruta solicitada no existe",
        "fecha" => date('c')
    ]);
}

function mostrarPaginaAnuncio()
{
    header('Content-Type: text/html; charset=utf-8');
    ?>
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CRIP-TECNOLOGÍA - Soluciones de Software Empresarial</title>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #06b6d4 100%);
                min-height: 100vh;
                color: #333;
                overflow-x: hidden;
            }
            
            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 2rem;
            }
            
            .header {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 20px;
                padding: 3rem;
                text-align: center;
                margin-bottom: 2rem;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            }
            
            .logo-section {
                margin-bottom: 2rem;
            }
            
            .company-logo {
                font-size: 4rem;
                background: linear-gradient(135deg, #1e3a8a, #06b6d4);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                font-weight: bold;
                margin-bottom: 0.5rem;
            }
            
            .company-name {
                font-size: 3rem;
                color: #1e3a8a;
                font-weight: 700;
                margin-bottom: 1rem;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
            }
            
            .tagline {
                font-size: 1.3rem;
                color: #4a5568;
                margin-bottom: 2rem;
                font-weight: 300;
            }
            
            .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #1e3a8a, #3b82f6);
                color: white;
                padding: 1rem 2rem;
                border-radius: 50px;
                text-decoration: none;
                font-weight: 600;
                font-size: 1.1rem;
                transition: all 0.3s ease;
                box-shadow: 0 10px 30px rgba(30, 58, 138, 0.3);
            }
            
            .cta-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 15px 40px rgba(30, 58, 138, 0.4);
            }
            
            .services-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 2rem;
                margin: 2rem 0;
            }
            
            .service-card {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 20px;
                padding: 2rem;
                text-align: center;
                box-shadow: 0 15px 35px rgba(0,0,0,0.1);
                transition: transform 0.3s ease;
            }
            
            .service-card:hover {
                transform: translateY(-5px);
            }
            
            .service-icon {
                font-size: 3rem;
                color: #3b82f6;
                margin-bottom: 1rem;
            }
            
            .service-title {
                font-size: 1.5rem;
                color: #1e3a8a;
                margin-bottom: 1rem;
                font-weight: 600;
            }
            
            .service-description {
                color: #4a5568;
                line-height: 1.6;
            }
            
            .tech-stack {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 20px;
                padding: 2rem;
                margin: 2rem 0;
                text-align: center;
                box-shadow: 0 15px 35px rgba(0,0,0,0.1);
            }
            
            .tech-title {
                font-size: 2rem;
                color: #1e3a8a;
                margin-bottom: 2rem;
                font-weight: 600;
            }
            
            .tech-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 1rem;
            }
            
            .tech-item {
                background: #f8fafc;
                padding: 1rem;
                border-radius: 15px;
                border-left: 4px solid #3b82f6;
                font-weight: 500;
                color: #1e3a8a;
            }
            
            .contact-info {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 20px;
                padding: 2rem;
                text-align: center;
                margin: 2rem 0;
                box-shadow: 0 15px 35px rgba(0,0,0,0.1);
            }
            
            .contact-title {
                font-size: 2rem;
                color: #1e3a8a;
                margin-bottom: 1rem;
                font-weight: 600;
            }
            
            .contact-details {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                margin-top: 1rem;
            }
            
            .contact-item {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                color: #4a5568;
                font-size: 1.1rem;
            }
            
            .contact-item i {
                color: #3b82f6;
            }
            
            .footer {
                text-align: center;
                color: rgba(255, 255, 255, 0.8);
                margin-top: 2rem;
                font-size: 0.9rem;
            }
            
            .status-badge {
                background: #10b981;
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 25px;
                font-weight: 600;
                display: inline-block;
                margin: 1rem 0;
                font-size: 0.9rem;
            }
            
            .api-info {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 20px;
                padding: 2rem;
                margin: 2rem 0;
                box-shadow: 0 15px 35px rgba(0,0,0,0.1);
            }
            
            .api-title {
                font-size: 1.8rem;
                color: #1e3a8a;
                text-align: center;
                margin-bottom: 1rem;
                font-weight: 600;
            }
            
            .endpoint-list {
                list-style: none;
                display: grid;
                gap: 0.5rem;
                margin-top: 1rem;
            }
            
            .endpoint-list li {
                background: #f8fafc;
                padding: 1rem;
                border-radius: 10px;
                border-left: 4px solid #3b82f6;
                font-family: 'Courier New', monospace;
                font-size: 0.9rem;
                color: #1e3a8a;
            }
            
            @media (max-width: 768px) {
                .container {
                    padding: 1rem;
                }
                
                .company-name {
                    font-size: 2rem;
                }
                
                .company-logo {
                    font-size: 2.5rem;
                }
                
                .services-grid {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo-section">
                    <div class="company-logo"><i class="fas fa-code"></i></div>
                    <h1 class="company-name">CRIP-TECNOLOGÍA</h1>
                    <p class="tagline">Innovación Digital • Soluciones Empresariales • Desarrollo de Software</p>
                </div>
                <div class="status-badge">
                    <i class="fas fa-check-circle"></i> Sistema API Activo
                </div>
                <a href="https://criptecnologia.com/" target="_blank" class="cta-button">
                    <i class="fas fa-globe"></i> Visitar Sitio Web
                </a>
            </div>

            <div class="services-grid">
                <div class="service-card">
                    <div class="service-icon"><i class="fas fa-laptop-code"></i></div>
                    <h3 class="service-title">Desarrollo de Software</h3>
                    <p class="service-description">
                        Creamos soluciones de software personalizadas para empresas, 
                        desde aplicaciones web hasta sistemas empresariales complejos.
                    </p>
                </div>
                
                <div class="service-card">
                    <div class="service-icon"><i class="fas fa-cloud"></i></div>
                    <h3 class="service-title">APIs REST</h3>
                    <p class="service-description">
                        Desarrollamos APIs robustas y escalables para integración 
                        de sistemas y comunicación entre aplicaciones.
                    </p>
                </div>
                
                <div class="service-card">
                    <div class="service-icon"><i class="fas fa-database"></i></div>
                    <h3 class="service-title">Gestión de Datos</h3>
                    <p class="service-description">
                        Diseñamos y optimizamos bases de datos para el manejo 
                        eficiente de información empresarial.
                    </p>
                </div>
                
                <div class="service-card">
                    <div class="service-icon"><i class="fas fa-shield-alt"></i></div>
                    <h3 class="service-title">Seguridad</h3>
                    <p class="service-description">
                        Implementamos las mejores prácticas de seguridad para 
                        proteger los datos y sistemas de nuestros clientes.
                    </p>
                </div>
            </div>

            <div class="tech-stack">
                <h2 class="tech-title"><i class="fas fa-tools"></i> Tecnologías que Dominamos</h2>
                <div class="tech-grid">
                    <div class="tech-item">PHP</div>
                    <div class="tech-item">MySQL</div>
                    <div class="tech-item">JavaScript</div>
                    <div class="tech-item">React</div>
                    <div class="tech-item">Node.js</div>
                    <div class="tech-item">Laravel</div>
                    <div class="tech-item">Docker</div>
                    <div class="tech-item">AWS</div>
                </div>
            </div>

            <div class="api-info">
                <h2 class="api-title"><i class="fas fa-plug"></i> API REST Disponible</h2>
                <p style="text-align: center; color: #4a5568; margin-bottom: 1rem;">
                    Endpoints para gestión empresarial - Versión 2.0
                </p>
                <ul class="endpoint-list">
                    <li><i class="fas fa-building"></i> /empresa - Gestión de empresas</li>
                    <li><i class="fas fa-users"></i> /persona - Gestión de personas</li>
                    <li><i class="fas fa-user"></i> /usuario - Gestión de usuarios</li>
                    <li><i class="fas fa-tags"></i> /categoria - Gestión de categorías</li>
                    <li><i class="fas fa-box"></i> /producto - Gestión de productos</li>
                </ul>
            </div>

            <div class="contact-info">
                <h2 class="contact-title"><i class="fas fa-envelope"></i> Contacto</h2>
                <p style="color: #4a5568; margin-bottom: 1rem;">
                    ¿Necesitas una solución tecnológica para tu empresa?
                </p>
                <div class="contact-details">
                    <div class="contact-item">
                        <i class="fas fa-globe"></i>
                        <span>criptecnologia.com</span>
                    </div>
                    <div class="contact-item">
                        <i class="fas fa-envelope"></i>
                        <span>informacion@criptecnologia.com</span>
                    </div>
                    <div class="contact-item">
                        <i class="fas fa-phone"></i>
                        <span>Consultas y Cotizaciones</span>
                    </div>
                </div>
            </div>

            <div class="footer">
                <p><i class="fas fa-clock"></i> Sistema iniciado: <?php echo date('d/m/Y H:i:s'); ?></p>
                <p><i class="fas fa-copyright"></i> <?php echo date('Y'); ?> CRIP-TECNOLOGÍA - Todos los derechos reservados</p>
                <p>Desarrollando el futuro digital de las empresas</p>
            </div>
        </div>
    </body>
    </html>
    <?php
}

?>