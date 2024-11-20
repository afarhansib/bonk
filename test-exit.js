console.log('Starting...')
setTimeout(() => {
  console.log('Exiting after 5 seconds')
  process.exit(1)
}, 5000)