const logger = require('../utils/logger');

const handleCastError = (err) => ({
  status: 400,
  message: `Invalid ${err.path}: ${err.value}`,
});

const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  return {
    status: 409,
    message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`,
  };
};

const handleValidationError = (err) => ({
  status: 400,
  message: Object.values(err.errors).map((e) => e.message).join('. '),
});

const handleMulterError = (err) => ({
  status: 400,
  message: err.message || 'File upload error',
});

const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';

  if (err.name === 'CastError') {
    const error = handleCastError(err);
    status = error.status;
    message = error.message;
  } else if (err.code === 11000) {
    const error = handleDuplicateKeyError(err);
    status = error.status;
    message = error.message;
  } else if (err.name === 'ValidationError') {
    const error = handleValidationError(err);
    status = error.status;
    message = error.message;
  } else if (err.name === 'MulterError') {
    const error = handleMulterError(err);
    status = error.status;
    message = error.message;
  }

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} - ${status}:`, err);
  }

  const response = { error: message };
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(status).json(response);
};

module.exports = errorHandler;
