import { supabase } from '../supabase/client.js'

export const verificarToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        
        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido' })
        }
        
        // Verificar token com Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token)
        
        if (error || !user) {
            return res.status(401).json({ error: 'Token inválido' })
        }
        
        req.usuario = user
        next()
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao verificar token' })
    }
}

export const verificarAdmin = async (req, res, next) => {
    // Verificar se usuário é admin (você pode ter uma tabela de admins)
    const { data: perfil } = await supabase
        .from('perfis')
        .select('tipo')
        .eq('id', req.usuario.id)
        .single()
    
    if (!perfil || perfil.tipo !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Requer privilégios de admin.' })
    }
    
    next()
}

// Função utilitária (não-middleware) usada quando você precisa checar
// programaticamente se um usuário é admin, sem interromper a requisição
// com um middleware. Usada em routes/estadios.js no DELETE de avaliações.
export const usuarioEhAdmin = async (usuarioId) => {
    const { data: perfil, error } = await supabase
        .from('perfis')
        .select('tipo')
        .eq('id', usuarioId)
        .single()

    if (error || !perfil) {
        return false
    }

    return perfil.tipo === 'admin'
}