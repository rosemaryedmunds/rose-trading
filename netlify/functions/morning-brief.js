[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[[redirects]]
  from = "/api/briefing"
  to = "/.netlify/functions/morning-brief"
  status = 200

[functions."morning-brief"]
  timeout = 30
