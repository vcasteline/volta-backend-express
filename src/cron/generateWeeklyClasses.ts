import { Request, Response } from 'express';
import { DateTime } from 'luxon';
import { supabase } from '../index';

export const generateWeeklyClassesCron = async (req: Request, res: Response) => {
  try {
    // Configurar zona horaria de Ecuador (UTC-5)
    const nowInEcuador = DateTime.now().setZone('America/Guayaquil');
    console.log(`[${nowInEcuador.toISO()}] Iniciando generación de clases semanales...`);

    // Calcular el próximo lunes
    let nextMonday = nowInEcuador.plus({ days: 1 }); // Mañana

    // Buscar el próximo lunes
    while (nextMonday.weekday !== 1) {
      nextMonday = nextMonday.plus({ days: 1 });
    }

    const nextMondayDateString = nextMonday.toISODate();
    console.log(`Generando clases para la semana del: ${nextMondayDateString}`);

    // Verificar si ya existen clases para esa semana
    const weekEnd = nextMonday.plus({ days: 6 }); // Domingo

    const { data: existingClasses, error: checkError } = await supabase
      .from('classes')
      .select('id, date')
      .gte('date', nextMondayDateString)
      .lte('date', weekEnd.toISODate());

    if (checkError) {
      throw new Error(`Error verificando clases existentes: ${checkError.message}`);
    }

    if (existingClasses && existingClasses.length > 0) {
      console.log(`⚠️ Ya existen ${existingClasses.length} clases para esa semana. Saltando generación.`);
      
      const skipResponse = {
        timestamp: nowInEcuador.toISO(),
        message: `Ya existen clases para la semana del ${nextMondayDateString}`,
        existingClasses: existingClasses.length,
        weekStart: nextMondayDateString,
        weekEnd: weekEnd.toISODate()
      };

      if (res && typeof res.json === 'function') {
        return res.status(200).json(skipResponse);
      }

      return skipResponse;
    }

    // Llamar a la función existente generate_weekly_classes
    const { data, error: rpcError } = await supabase.rpc('generate_weekly_classes', {
      start_date_input: nextMondayDateString
    });

    if (rpcError) {
      throw new Error(`Error en generate_weekly_classes: ${rpcError.message}`);
    }

    // Contar las clases creadas
    const { data: newClasses, error: countError } = await supabase
      .from('classes')
      .select(`
        id, 
        date, 
        start_time, 
        end_time, 
        name, 
        instructor_id,
        instructors(name)
      `)
      .gte('date', nextMondayDateString)
      .lte('date', weekEnd.toISODate())
      .order('date')
      .order('start_time');

    if (countError) {
      console.error('Error contando clases nuevas:', countError);
    }

    const summary = {
      timestamp: nowInEcuador.toISO(),
      weekStart: nextMondayDateString,
      weekEnd: weekEnd.toISODate(),
      classesGenerated: newClasses?.length || 0,
      classes: newClasses?.map(c => ({
        date: c.date,
        time: `${c.start_time} - ${c.end_time}`,
        name: c.name,
        instructor: (c.instructors as any)?.name || 'Sin instructor'
      })) || [],
      message: `✅ Clases generadas exitosamente para la semana del ${nextMondayDateString}`
    };

    console.log('📊 Resumen:', summary);

    // Verificar si res es válido antes de responder
    if (res && typeof res.json === 'function') {
      return res.status(200).json(summary);
    }

    return summary;

  } catch (error: any) {
    console.error('❌ Error en generate-weekly-classes:', error);
    
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