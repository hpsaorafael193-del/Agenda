🗓️ Agenda Obstétrica — Hospital São Rafael (RP)

Sistema web para agendamento, visualização e gerenciamento de partos, desenvolvido para uso em Roleplay médico, com foco em organização clínica, padronização de agenda e sincronização em tempo real entre profissionais.

📌 Visão Geral

Este projeto permite:

Agendamento de partos por data e horário

Associação do agendamento a um médico responsável

Visualização mensal em formato de calendário

Marcação de agendamentos como concluídos

Cancelamento de agendamentos

Sincronização em tempo real entre todos os usuários conectados

Prevenção automática de conflitos de horário no banco de dados

O sistema foi projetado para funcionar como módulo de um sistema clínico maior.

🏥 Contexto de Uso

Este sistema foi desenvolvido exclusivamente para uso interno em Roleplay Médico, no servidor Eldorado, pelo grupo do Hospital São Rafael (HPSR).

Não se trata de um sistema médico real e não deve ser utilizado em ambiente clínico verdadeiro.

🧩 Arquitetura
Frontend

HTML5

CSS3

JavaScript (Vanilla JS)

Hospedado via GitHub Pages

Backend / Dados

Supabase (PostgreSQL)

Row Level Security (RLS)

Constraints SQL para regras de negócio

Supabase Realtime (WebSocket)

🔐 Segurança e Regras de Negócio
Row Level Security (RLS)

RLS ativado na tabela appointments

Policy aberta para leitura e escrita (modo MVP / RP)

Regra Anti-Conflito (Banco de Dados)

O banco impede automaticamente que:

O mesmo médico

Tenha dois agendamentos

Com menos de 5 horas de diferença

Enquanto o status estiver como agendado

Essa regra é aplicada diretamente no PostgreSQL, não dependendo do frontend.

⚡ Realtime (Sincronização ao Vivo)

O sistema utiliza Supabase Realtime para escutar alterações na tabela de agendamentos.

Sempre que ocorre:

Inserção

Atualização

Exclusão

Todos os usuários conectados veem a agenda atualizar instantaneamente, sem recarregar a página.

📅 Funcionalidades Principais

✅ Criação de agendamentos

✅ Validação de conflitos de horário

✅ Visualização em calendário mensal

✅ Destaque de dia atual

✅ Status: Agendado / Concluído

✅ Cancelamento de agendamentos

✅ Atualização em tempo real (multiusuário)

✅ Persistência centralizada no banco de dados

🧪 Observações Técnicas

O frontend envia datas em formato ISO (toISOString)

O banco utiliza timestamp with time zone (timestamptz)

As regras críticas são garantidas no banco, não apenas no JavaScript

O sistema está preparado para futura evolução com:

Login por médico

RLS por usuário

Métricas e dashboards

⚠️ Aviso Legal

Este projeto:

❌ Não é um sistema médico real

❌ Não segue normas de saúde oficiais

❌ Não deve ser usado para tomada de decisões clínicas reais

Uso estritamente educacional e recreativo (RP).

📄 Licença

Uso restrito.

Este software é de autoria do desenvolvedor e destinado exclusivamente ao uso interno do grupo do Hospital São Rafael (HPSR) no servidor Eldorado.

Nenhuma redistribuição, comercialização ou uso externo é permitida sem autorização expressa do autor.

👤 Autor

Desenvolvido por Luddhiev
GitHub: https://github.com/Luidhycs