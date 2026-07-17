<?php

define("FMP_API_KEY", getenv("FMP_API_KEY") ?: "");

define("BINANCE_BASE_URL", "https://api.binance.com/api/v3");

define("FRANKFURTER_BASE_URL", "https://api.frankfurter.app");

define("FMP_BASE_URL", "https://financialmodelingprep.com/api/v3");

define("PRO_NOMBRE", "Crip-Tecnología");

define("CORS_ORIGIN", getenv("CORS_ORIGIN") ?: "http://localhost:8100");

define("APP_VERSION", getenv("APP_VERSION") ?: "1.0.0");

define("CACHE_TTL_CRIPTO", getenv("CACHE_TTL_CRIPTO") ?: 30);
define("CACHE_TTL_FOREX", getenv("CACHE_TTL_FOREX") ?: 60);
define("CACHE_TTL_INDICE", getenv("CACHE_TTL_INDICE") ?: 60);
define("CACHE_DIR", __DIR__ . '/../cache');
