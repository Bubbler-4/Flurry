FROM gitpod/workspace-full:latest

USER root
RUN curl -fsSL https://deno.land/x/install/install.sh | sh
