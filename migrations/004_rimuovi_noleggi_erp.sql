-- I noleggi non arrivano più dall'ERP: elimina le righe canone storicizzate dal sync.
-- I noleggi inseriti a mano (origine = 'MANUALE') non vengono toccati.
DELETE FROM storia_noleggi WHERE origine = 'ERP';
