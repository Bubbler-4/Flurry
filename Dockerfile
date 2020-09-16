FROM gitpod/workspace-full:latest

USER root
RUN apt-get update -y -q \
  && add-apt-repository ppa:avsm/ppa \
  && apt-get update -y -q \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y -q --no-install-recommends opam \
  && opam init \
  && opam update \
  && opam install js_of_ocaml js_of_ocaml-compiler js_of_ocaml-ppx
