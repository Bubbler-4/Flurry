FROM gitpod/workspace-full:latest

USER root
RUN apt-get update -y -q \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y -q --no-install-recommends opam \
  && opam init -y --disable-sandboxing \
  && opam update \
  && opam install -y \
    js_of_ocaml \
    js_of_ocaml-compiler \
    js_of_ocaml-ocamlbuild \
    js_of_ocaml-toplevel \
    js_of_ocaml-ppx \
    js_of_ocaml-lwt \
    js_of_ocaml-tyxml
