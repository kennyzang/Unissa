import styles from './PageLoader.module.scss'

const PageLoader = () => (
  <div className={styles.wrapper}>
    <div className={styles.spinner} />
    <span className={styles.text}>Loading...</span>
  </div>
)

export default PageLoader
