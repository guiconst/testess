import express from 'express'
import { supabase, supabaseAdmin } from '../supabase/client.js'
import { verificarToken } from '../middleware/auth.js'
import { body, validationResult } from 'express-validator'
import multer from 'multer'

const router = express.Router()

// Configurar upload de imagens
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
})

// Listar restaurantes
router.get('/', async (req, res) => {
    const { cidade, tipo_comida, minNota } = req.query

    let query = supabase
        .from('avaliacoes_restaurantes')
        .select('*')
        .order('data_avaliacao', { ascending: false })

    if (cidade) query = query.eq('cidade', cidade)
    if (tipo_comida) query = query.eq('tipo_comida', tipo_comida)
    if (minNota) query = query.gte('nota_comida', minNota)

    const { data, error } = await query

    if (error) {
        return res.status(500).json({ error: error.message })
    }

    res.json(data)
})

// Criar avaliação com foto
router.post('/', verificarToken, upload.single('foto'), [
    body('nome_estabelecimento').notEmpty().trim(),
    body('cidade').notEmpty().trim(),
    body('tipo_comida').notEmpty().trim(),
    body('nota_comida').isInt({ min: 1, max: 5 }),
    body('nota_atendimento').isInt({ min: 1, max: 5 }),
    body('nota_preco').isInt({ min: 1, max: 5 })
], async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
    }

    let foto_url = null

    // Upload da foto para Supabase Storage
    if (req.file) {
        const fileName = `${Date.now()}_${req.file.originalname}`
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('fotos-restaurantes')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype
            })

        if (uploadError) {
            // Antes, esse erro era silenciosamente ignorado e a avaliação
            // seguia sem foto. Agora retornamos erro explícito ao cliente.
            console.error('Erro no upload da foto:', uploadError)
            return res.status(500).json({ error: 'Falha ao enviar a foto. Tente novamente.' })
        }

        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('fotos-restaurantes')
            .getPublicUrl(fileName)
        foto_url = publicUrl
    }

    const avaliacao = {
        nome_estabelecimento: req.body.nome_estabelecimento,
        cidade: req.body.cidade,
        tipo_comida: req.body.tipo_comida,
        nota_comida: parseInt(req.body.nota_comida),
        nota_atendimento: parseInt(req.body.nota_atendimento),
        nota_preco: parseInt(req.body.nota_preco),
        usuario_id: req.usuario.id,
        foto_url,
        data_avaliacao: new Date()
    }

    const { data, error } = await supabase
        .from('avaliacoes_restaurantes')
        .insert([avaliacao])
        .select()
        .single()

    if (error) {
        return res.status(500).json({ error: error.message })
    }

    res.status(201).json({ success: true, data })
})

// Melhores restaurantes por tipo
router.get('/melhores/:cidade', async (req, res) => {
    const { cidade } = req.params

    const { data, error } = await supabase
        .from('avaliacoes_restaurantes')
        .select('nome_estabelecimento, tipo_comida, nota_comida, nota_atendimento, preco_medio')
        .eq('cidade', cidade)
        .order('nota_comida', { ascending: false })
        .limit(20)

    if (error) {
        return res.status(500).json({ error: error.message })
    }

    res.json(data)
})

export default router