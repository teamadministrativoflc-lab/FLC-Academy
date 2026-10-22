-- FLC Academy: preparatory server-only question answer bank.
-- Do not run until coordinated quiz API cutover is ready.
-- Answer keys must never be readable by authenticated/anon clients.
create table if not exists public.flc_quiz_answer_key (
 question_id integer primary key,
 topic text not null check(topic in ('fundamentos','guion','objeciones')),
 question_text text not null unique,
 correct_index integer not null check(correct_index between 0 and 5)
);
alter table public.flc_quiz_answer_key enable row level security;
revoke all on public.flc_quiz_answer_key from public, anon, authenticated;
-- No read/write RLS policies; only privileged server-side functions may access.
insert into public.flc_quiz_answer_key (question_id,topic,question_text,correct_index)
values
 (1,'fundamentos','¿Qué es un seguro de vida?',1),
 (2,'fundamentos','¿Cuáles son los 3 tipos de seguro que trabajamos en la agencia?',1),
 (3,'fundamentos','¿Qué significa "IUL"?',1),
 (4,'fundamentos','¿Qué es el "beneficiario primario" en una póliza?',2),
 (5,'fundamentos','¿Qué son los "Living Benefits" en un IUL?',1),
 (6,'fundamentos','El IUL tiene un piso de 0% que protege el capital principal cuando el mercado baja.',0),
 (7,'fundamentos','El seguro de vida a Término (Term) acumula valor en efectivo que el cliente puede retirar.',1),
 (8,'fundamentos','¿Qué es un seguro de Gastos Finales?',1),
 (9,'fundamentos','En un seguro de Gastos Finales MODIFICADO, si la persona fallece antes de los 2 años, ¿qué reciben los beneficiarios?',2),
 (10,'fundamentos','¿Qué es la "Prima" en un seguro?',1),
 (11,'fundamentos','¿Qué es el "Face Amount" de una póliza?',2),
 (12,'fundamentos','Cuando una póliza "lapsa", significa que se canceló por falta de pago.',0),
 (13,'fundamentos','ESCENARIO: Cliente de 55 años con diabetes tipo 2 no controlada busca protección para su familia. Quiere cobertura permanente. ¿Cuál es la MEJOR opción?',2),
 (14,'fundamentos','ESCENARIO: Cliente hispano sin SSN, solo tiene pasaporte. Quiere un IUL. ¿Qué compañía trabajamos que lo acepta?',2),
 (15,'fundamentos','¿Qué es un "Rider" en una póliza?',1),
 (16,'guion','¿Cuál es el ORDEN CORRECTO de los primeros pasos del guion oficial?',1),
 (17,'guion','En el paso "Prueba social", ¿qué porcentaje del ingreso mensual anclamos como referencia de aporte?',1),
 (18,'guion','En "Saca el dolor", cuando el cliente elige PROTEGER A LA FAMILIA, ¿qué haces primero?',1),
 (19,'guion','¿Cuáles son las 3 rutas de "dolor" en el guion?',1),
 (20,'guion','En "Explica el IUL", ¿cuáles son los 3 beneficios clave que se presentan?',1),
 (21,'guion','En el paso "Diseño de póliza", ¿cuáles son las 2 opciones que se presentan?',2),
 (22,'guion','En el paso "Preséntate", debes SIEMPRE terminar con una pregunta.',0),
 (23,'guion','En el paso "Califica", ¿qué información legal debes levantar?',2),
 (24,'guion','En el paso "Cierra", después de levantar los datos, ¿qué advertencia IMPORTANTE le das al cliente?',1),
 (25,'guion','En "Referidos", ¿cuántos nombres pides al cierre?',1),
 (26,'guion','Antes de compartir pantalla en el paso "Explica el IUL", debes enviar tus credenciales por mensaje.',0),
 (27,'guion','Si en "Preséntate" el cliente responde "no recuerdo" cuando le preguntas qué le gustó del IUL, ¿qué haces?',2),
 (28,'guion','ESCENARIO: Estás en el paso "Explica el IUL" y notas que el cliente dejó de responder. ¿Qué haces?',1),
 (29,'guion','En "Califica" preguntas sobre la salud del cliente. ¿Qué condiciones importantes MÍNIMO debes preguntar?',1),
 (30,'guion','ESCENARIO: Cliente dice "necesito consultar con mi pareja". ¿En qué paso del guion detectaste esto y qué haces?',1),
 (31,'objeciones','CLIENTE: "No tengo dinero." ¿Cuál es la MEJOR respuesta?',1),
 (32,'objeciones','CLIENTE: "Necesito pensarlo." ¿Cuál es la respuesta CORRECTA?',0),
 (33,'objeciones','CLIENTE: "Tengo que hablar con mi pareja." ¿Qué haces?',2),
 (34,'objeciones','CLIENTE: "No tengo ITIN ni Seguro Social." ¿Qué le respondes?',1),
 (35,'objeciones','CLIENTE: "Esto es muy caro." ¿Cuál es la respuesta CORRECTA?',1),
 (36,'objeciones','CLIENTE: "¿Cuánto vas a ganar tú?" ¿Cómo respondes?',1),
 (37,'objeciones','CLIENTE: "Ya intenté antes y no me aprobaron." ¿Qué respondes?',1),
 (38,'objeciones','CLIENTE: "No creo en los seguros." ¿Qué respondes?',1),
 (39,'objeciones','CLIENTE: "Soy joven, tengo tiempo." ¿Cómo respondes?',1),
 (40,'objeciones','CLIENTE: "No sé si puedo mantener los pagos." ¿Cómo respondes?',1),
 (41,'objeciones','Al manejar una objeción, ¿cuál es el PRIMER paso siempre?',1),
 (42,'objeciones','CLIENTE: "¿Y si pierdo el trabajo?" ¿Qué respondes?',1),
 (43,'objeciones','CLIENTE: "Ya tengo un seguro." ¿Cómo respondes?',1),
 (44,'objeciones','Cuando un cliente objeta, hay que insistir hasta que compre.',1),
 (45,'objeciones','CLIENTE: "No quiero hablar con un vendedor." ¿Qué respondes?',1)
on conflict (question_id) do update set
 topic=excluded.topic,question_text=excluded.question_text,correct_index=excluded.correct_index;
