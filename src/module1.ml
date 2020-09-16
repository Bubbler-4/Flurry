let hello_string = "hello"

let hello name = Printf.printf "hello %s!\n" name

let contentId = Js.string "content"
let content = Dom_html.document##getElementById