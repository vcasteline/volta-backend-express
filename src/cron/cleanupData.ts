import { Request, Response } from 'express';
import { DateTime } from 'luxon';
import { supabase } from '../index';

export const cleanupDataCron = async (req: Request, res: Response) => {
  try {
    const nowInEcuador = DateTime.now().setZone('America/Guayaquil');
    console.log(`[${nowInEcuador.toISO()}] Iniciando limpieza de datos...`);

    let summary = {
      timestamp: nowInEcuador.toISO(),
      oldReservationsCleaned: 0,
      expiredCreditsCleaned: 0,
      orphanedPhotosCleaned: 0,
      oldNotificationsCleaned: 0,
      oldClassesCleaned: 0,
      message: ''
    };

    // 1. Limpiar reservaciones canceladas muy antiguas (más de 6 meses)
    const sixMonthsAgo = nowInEcuador.minus({ months: 6 }).toISODate();
    
    const { data: oldReservations, error: oldResError } = await supabase
      .from('reservations')
      .delete()
      .eq('status', 'cancelled')
      .lt('created_at', sixMonthsAgo)
      .select('id');

    if (oldResError) {
      console.error('Error limpiando reservaciones antiguas:', oldResError);
    } else {
      summary.oldReservationsCleaned = oldReservations?.length || 0;
      console.log(`🗑️ ${summary.oldReservationsCleaned} reservaciones canceladas antiguas eliminadas`);
    }

    // 2. Marcar créditos expirados como tal
    const today = nowInEcuador.toISODate();
    
    const { data: expiredPurchases, error: expiredError } = await supabase
      .from('purchases')
      .update({ credits_remaining: 0 })
      .lt('expiration_date', today)
      .gt('credits_remaining', 0)
      .select('id');

    if (expiredError) {
      console.error('Error marcando créditos expirados:', expiredError);
    } else {
      summary.expiredCreditsCleaned = expiredPurchases?.length || 0;
      console.log(`⏰ ${summary.expiredCreditsCleaned} paquetes de créditos marcados como expirados`);
    }

    // 3. Limpiar notificaciones enviadas antiguas (más de 3 meses)
    const threeMonthsAgo = nowInEcuador.minus({ months: 3 }).toISODate();
    
    const { data: oldNotifications, error: notifError } = await supabase
      .from('notifications')
      .delete()
      .eq('sent', true)
      .lt('created_at', threeMonthsAgo)
      .select('id');

    if (notifError) {
      console.error('Error limpiando notificaciones antiguas:', notifError);
    } else {
      summary.oldNotificationsCleaned = oldNotifications?.length || 0;
      console.log(`📧 ${summary.oldNotificationsCleaned} notificaciones antiguas eliminadas`);
    }

    // 4. Limpiar archivos huérfanos de instructor-photos
    try {
      // Obtener todos los archivos en el bucket
      const { data: files, error: listError } = await supabase.storage
        .from('instructor-photos')
        .list('', { limit: 1000 });

      if (listError) {
        console.error('Error listando archivos:', listError);
      } else if (files && files.length > 0) {
        // Obtener URLs de fotos que están siendo usadas
        const { data: instructorsWithPhotos, error: instructorsError } = await supabase
          .from('instructors')
          .select('profile_picture_url')
          .not('profile_picture_url', 'is', null);

        if (!instructorsError && instructorsWithPhotos) {
          const usedFileNames = instructorsWithPhotos.map(instructor => {
            if (instructor.profile_picture_url?.includes('instructor-photos/')) {
              return instructor.profile_picture_url.split('/').pop();
            }
            return null;
          }).filter(Boolean);

          // Archivos huérfanos = archivos en storage que no están siendo usados
          const orphanedFiles = files.filter(file => 
            file.name !== '.emptyFolderPlaceholder' && 
            !usedFileNames.includes(file.name)
          );

          // Eliminar archivos huérfanos (máximo 10 por ejecución para evitar timeouts)
          const filesToDelete = orphanedFiles.slice(0, 10);
          
          if (filesToDelete.length > 0) {
            const { error: deleteError } = await supabase.storage
              .from('instructor-photos')
              .remove(filesToDelete.map(f => f.name));

            if (!deleteError) {
              console.log(`🖼️ ${filesToDelete.length} fotos huérfanas eliminadas`);
              summary.orphanedPhotosCleaned = filesToDelete.length;
            } else {
              console.error('Error eliminando fotos huérfanas:', deleteError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error en limpieza de fotos huérfanas:', error);
      // No es un error crítico, continúa
    }

    // 5. Limpiar clases muy antiguas sin reservaciones (más de 1 año)
    const oneYearAgo = nowInEcuador.minus({ years: 1 }).toISODate();
    
    const { data: emptyOldClasses, error: classError } = await supabase
      .from('classes')
      .select(`
        id,
        date,
        reservations!left (id)
      `)
      .lt('date', oneYearAgo)
      .is('reservations.id', null); // Clases sin reservaciones

    if (!classError && emptyOldClasses && emptyOldClasses.length > 0) {
      // Eliminar bikes asociadas a estas clases primero
      const classIds = emptyOldClasses.map(c => c.id);
      
      await supabase
        .from('bikes')
        .delete()
        .in('class_id', classIds);

      // Luego eliminar las clases
      const { error: deleteClassError } = await supabase
        .from('classes')
        .delete()
        .in('id', classIds);

      if (!deleteClassError) {
        summary.oldClassesCleaned = emptyOldClasses.length;
        console.log(`🗓️ ${emptyOldClasses.length} clases antiguas sin reservaciones eliminadas`);
      }
    }

    summary.message = `Limpieza completada: ${summary.oldReservationsCleaned} reservaciones, ${summary.expiredCreditsCleaned} créditos expirados, ${summary.oldNotificationsCleaned} notificaciones, ${summary.oldClassesCleaned} clases antiguas`;

    console.log('📊 Resumen de limpieza:', summary);

    // Verificar si res es válido antes de responder
    if (res && typeof res.json === 'function') {
      return res.status(200).json(summary);
    }

    return summary;

  } catch (error: any) {
    console.error('❌ Error en cleanup-data:', error);
    
    const errorResponse = {
      error: error.message,
      timestamp: DateTime.now().setZone('America/Guayaquil').toISO()
    };

    if (res && typeof res.status === 'function') {
      return res.status(500).json(errorResponse);
    }

    throw error;
  }
}; 