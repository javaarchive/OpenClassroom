module.exports = {
  "NAME":"Open Classroom Demo",
  "database":"sqlite://.data/storage.sqlite",
  "require_verified_email":true, // Require a verified google email
  "trust_all_domains": false, 
  "trusted_domains":["gmail.com","googlemail.com"],// Trusted email domains
  "teachers":["awesomecatstudio@gmail.com"] // Emails of teachers you trust
}