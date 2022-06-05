try {
  const generator = require('generate-password')

  const password = generator.generate({ length: 150, numbers: true })

  console.log(password)
} catch (error) {
  console.error('ensure that generate-password is installed: `npm i -g generate-password`')
}
