import streamlit as st
import pandas as pd
import numpy as np

st.title('Meu Primeiro App Completo com Streamlit')
st.write('Olá! Bem-vindo ao meu app Streamlit.')

nome = st.text_input('Qual é o seu nome?')
if nome:
    st.write(f'Olá, {nome}! Prazer te conhecer.')

if st.button('Clique aqui'):
    st.write('Você clicou no botão!')

st.write('Aqui está um gráfico de exemplo:')
data = pd.DataFrame({
    'x': np.arange(10),
    'y': np.random.randn(10)
})
st.line_chart(data)

uploaded_file = st.file_uploader('Escolha um arquivo CSV')
if uploaded_file:
    df = pd.read_csv(uploaded_file)
    st.write('Conteúdo do CSV:')
    st.write(df)
