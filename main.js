if ('electron' in process.versions) {
  require('./electron');
} else {
  require('./server');
}